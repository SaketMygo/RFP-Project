import os
import psycopg2
import pandas as pd
from docx import Document
from pypdf import PdfReader
from google import genai
from google.genai import types
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer

# Load credentials
load_dotenv()

def extract_excel_requirements(file_path):
    """Reads Excel and returns a list of tuples: (row_id, question_text, sheet_name)"""
    requirements = []
    xls = pd.ExcelFile(file_path)
    for sheet_name in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet_name)
        # Drop completely empty rows
        df = df.dropna(how='all')
        
        for index, row in df.iterrows():
            # Convert the entire row's data into a readable string if columns aren't uniform
            row_text = " | ".join([f"{col}: {str(val)}" for col, val in row.items() if pd.notna(val)])
            if row_text.strip():
                row_number = index + 1
                requirements.append((f"ROW-{row_number}", row_text, sheet_name))
    return requirements

def extract_docx_requirements(file_path):
    """Reads Word Document paragraphs as individual requirement items"""
    requirements = []
    doc = Document(file_path)
    item_counter = 1
    for para in doc.paragraphs:
        text = para.text.strip()
        if len(text) > 20:  # Skip short lines or blank headers
            requirements.append((f"PARA-{item_counter}", text, "Document Body"))
            item_counter += 1
    return requirements

def extract_pdf_requirements(file_path):
    """Reads PDF pages as individual requirement chunks"""
    requirements = []
    reader = PdfReader(file_path)
    for page_num, page in enumerate(reader.pages, 1):
        text = page.extract_text()
        if text and len(text.strip()) > 20:
            requirements.append((f"PAGE-{page_num}", text.strip(), "PDF Page"))
    return requirements

def process_bulk_rfp(file_path):
    db_password = os.getenv("DB_PASSWORD")
    gemini_key = os.getenv("GEMINI_API_KEY")
    
    if not db_password or not gemini_key:
        print("❌ Error: Missing credentials.")
        return

    # Initialize Clients & Models
    ai_client = genai.Client(api_key=gemini_key)
    print("🧠 Loading embedding model...")
    embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    
    # Extract based on file type
    filename = os.path.basename(file_path)
    ext = filename.split('.')[-1].lower()
    
    print(f"📂 Analyzing uploaded file: {filename}")
    if ext == 'xlsx':
        incoming_items = extract_excel_requirements(file_path)
    elif ext == 'docx':
        incoming_items = extract_docx_requirements(file_path)
    elif ext == 'pdf':
        incoming_items = extract_pdf_requirements(file_path)
    else:
        print(f"❌ Unsupported file format: .{ext}")
        return

    print(f"📋 Extracted {len(incoming_items)} items for compliance evaluation.")
    
    # Connect to PostgreSQL
    conn = psycopg2.connect(
        dbname="rfp_tracker_db", user="postgres", password=db_password, host="localhost", port="5432"
    )
    cursor = conn.cursor()
    
    system_instruction = "You are a principal SAP enterprise architect evaluating customer RFP metrics against context realities."
    default_bid_id = 1
    
    # Loop through every extracted item automatically
    for req_id, question_text, context_tab in incoming_items:
        print(f"\n🔄 Evaluating {req_id}...")
        
        # 1. Vector Search against your 20,350 master records
        query_embedding = embedding_model.encode(question_text).tolist()
        cursor.execute("""
            SELECT text_content, folder_source, file_source
            FROM master_knowledge_base
            ORDER BY vector_embedding <=> %s::vector
            LIMIT 3;
        """, (query_embedding,))
        knowledge_matches = cursor.fetchall()
        
        context_blocks = []
        detected_sources = []
        for text_chunk, folder_src, file_src in knowledge_matches:
            context_blocks.append(f"[Source File: {file_src}]\nContext: {text_chunk}")
            if file_src not in detected_sources:
                detected_sources.append(file_src)
        
        compiled_context = "\n\n---\n\n".join(context_blocks)
        
        # 2. Get AI Analysis from Gemini
        mapping_prompt = f"""
        Context Knowledge Base:
        {compiled_context}
        
        Customer RFP Question:
        "{question_text[:2000]}"
        
        Respond EXACTLY in this format:
        MODULE: <Primary SAP Module acronym>
        FITMENT: <Full Compliance, Configurable, Custom Development, Third-Party Solution, Non-Compliant>
        RESPONSE: <Neutral, professional technical implementation explanation>
        """
        
        try:
            ai_output = ai_client.models.generate_content(
                model='gemini-3-flash-preview',
                contents=mapping_prompt,
                config=types.GenerateContentConfig(system_instruction=system_instruction, temperature=0.1)
            ).text
            
            # Parse response fields
            sap_module = "Cross-Application"
            fitment_score = "Full Compliance"
            ai_response_text = ai_output
            
            for line in ai_output.split('\n'):
                clean_line = line.strip()
                if clean_line.startswith("MODULE:"):
                    sap_module = clean_line.replace("MODULE:", "").strip()
                elif clean_line.startswith("FITMENT:"):
                    fitment_score = clean_line.replace("FITMENT:", "").strip()
                elif clean_line.startswith("RESPONSE:"):
                    ai_response_text = clean_line.replace("RESPONSE:", "").strip()
            
            # 3. Log directly into PostgreSQL using the TRUE source file metrics
            cursor.execute("""
                INSERT INTO requirements (
                    bid_id, requirement_id_source, section_tab, source_document, 
                    source_sheet_tab, question_text, sap_module, fitment_score, 
                    ai_generated_response, ai_sources_listed
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, (
                default_bid_id,
                req_id,             # e.g., ROW-11, PARA-4, PAGE-2
                context_tab,        # The tab name or document section
                filename,           # The user's uploaded file name
                'Batch Processed',  # Process stamp
                question_text[:1000], 
                sap_module, 
                fitment_score, 
                ai_response_text, 
                ", ".join(detected_sources)
            ))
            conn.commit()
            print(f"✅ Saved {req_id} | Fitment: {fitment_score} | Module: {sap_module}")
            
        except Exception as e:
            print(f"⚠️ Error processing item {req_id}: {str(e)}")
            conn.rollback()

    print("\n🏁 Bulk processing complete! Check pgAdmin for the newly evaluated records.")
    cursor.close()
    conn.close()

if __name__ == "__main__":
    # Target path pointing straight to your California JCC RFI PDF file
    target_file = r"C:\Users\Saket Dronamraju\Desktop\RFP project\01-RFPs-RFIs-RFQs\Active Bids\1 - New Judicial Council Of California - May 20th\New Judicial Council Of California - May 20th- rfi-bap-2026-208-rb.pdf"
    
    if os.path.exists(target_file):
        process_bulk_rfp(target_file)
    else:
        print(f"❌ File not found! Double-check your path layout:\n{target_file}")