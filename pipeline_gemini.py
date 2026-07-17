import os
import datetime
import psycopg2
from google import genai
from dotenv import load_dotenv

# Load credentials from .env
load_dotenv()

def run_gemini_pipeline():
    # 1. Initialize Clients
    db_password = os.getenv("DB_PASSWORD")
    gemini_key = os.getenv("GEMINI_API_KEY")
    
    if not db_password or not gemini_key:
        print("❌ Error: Missing DB_PASSWORD or GEMINI_API_KEY in .env file.")
        return

    # Setup Gemini Client using the modern SDK
    ai_client = genai.Client(api_key=gemini_key)
    
    # Connect to PostgreSQL
    conn = psycopg2.connect(
        dbname="rfp_tracker_db",
        user="postgres",
        password=db_password,
        host="localhost",
        port="5432"
    )
    cursor = conn.cursor()
    print("🔌 Connected to PostgreSQL and Gemini successfully.")

    # ---------------------------------------------------------------------------
    # PHASE 1: TARGET DATA & TIMELINE ENGINE (Requirement 5)
    # ---------------------------------------------------------------------------
    # Simulation data representing your newly targeted active bid folder
    bid_name = "TURCK-SAP-Implementation"
    folder_path = "01-RFPs-RFIs-RFQs\\Active Bids\\0-TURCK. - may 8th"
    bid_manager = "Saket Dronamraju"
    
    # a. Bid received date (Defaults to today, but overridable)
    bid_received_date = datetime.date.today() 
    
    # b. Ask Gemini to extract the target date out of sample text block or document string
    sample_rfp_text_snippet = "All final proposal responses must be uploaded to the vendor portal no later than June 26, 2026."
    
    print("🤖 Prompting Gemini to isolate the exact Bid Submission Date...")
    prompt = f"Extract only the final due date from this text as YYYY-MM-DD. Text: {sample_rfp_text_snippet}"
    response = ai_client.models.generate_content(
        model='gemini-3-flash-preview',
        contents=prompt
    )
    
    try:
        extracted_date_str = response.text.strip()
        bid_submission_date = datetime.datetime.strptime(extracted_date_str, "%Y-%m-%d").date()
    except Exception:
        # Fallback if text formatting gets weird
        bid_submission_date = bid_received_date + datetime.timedelta(days=20)

    # c. Calculate strict dynamic timelines based on project parameters
    draft_bid_proposal_date = bid_received_date + datetime.timedelta(days=3)  # e. Received + 3 days
    sme_review_due_date = draft_bid_proposal_date + datetime.timedelta(days=3)  # f. Draft + 3 days
    management_approval_date = bid_submission_date - datetime.timedelta(days=2)  # g. Submission - 2 days

    # Dump Master Bid into PostgreSQL
    try:
        cursor.execute("""
            INSERT INTO bids (
                bid_name, folder_path, bid_manager, complexity, 
                bid_received_date, bid_submission_date, 
                draft_bid_proposal_date, sme_review_due_date, management_approval_date
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (bid_name) DO UPDATE SET folder_path = EXCLUDED.folder_path
            RETURNING bid_id;
        """, (
            bid_name, folder_path, bid_manager, 'High', 
            bid_received_date, bid_submission_date, 
            draft_bid_proposal_date, sme_review_due_date, management_approval_date
        ))
        bid_id = cursor.fetchone()[0]
        print(f"📥 Master Bid created in Postgres! Assigned Database ID: {bid_id}")

        # ---------------------------------------------------------------------------
        # PHASE 2: PARSE REQUIREMENTS & GENERATE RESPONSE (Requirements 3, 6, 7)
        # ---------------------------------------------------------------------------
        # Sample structured question row found in the document
        sample_question = "Does your system support automated batch creation of outbound deliveries from sales orders?"
        source_doc = "TURCK_Functional_Matrix.xlsx"
        source_tab = "Logistics_Execution"
        req_id_source = "REQ-042"

        print("🤖 Tasking Gemini to categorize module and draft a neutral third-party answer...")
        
        # We tell Gemini to give us a clean, split answer structure
        mapping_prompt = f"""
        Analyze this customer RFP question: "{sample_question}"
        1. Identify the primary relevant SAP Module acronym (e.g., FICO, MM, SD, EWM).
        2. Draft a highly professional, neutral, third-party technical response answering how a standard SAP environment handles this.
        
        Respond EXACTLY in this format:
        MODULE: <Module Acronym>
        RESPONSE: <Neutral technical answer text>
        """
        
        ai_output = ai_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=mapping_prompt
        ).text

        # Quick parsing of Gemini's response structure
        sap_module = "Cross-Application"
        ai_response_text = ai_output
        
        for line in ai_output.split('\n'):
            if line.startswith("MODULE:"):
                sap_module = line.replace("MODULE:", "").strip()
            elif line.startswith("RESPONSE:"):
                ai_response_text = line.replace("RESPONSE:", "").strip()

        # Dump Requirement data cleanly into your PostgreSQL requirements table
        cursor.execute("""
            INSERT INTO requirements (
                bid_id, requirement_id_source, section_tab, source_document, 
                source_sheet_tab, question_text, sap_module, ai_generated_response, fitment_score
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
        """, (
            bid_id, req_id_source, 'Functional requirements', source_doc,
            source_tab, sample_question, sap_module, ai_response_text, 'Full Compliance'
        ))
        
        conn.commit()
        print("✨ Success! Gemini-extracted data has been fully dumped into PostgreSQL.")

    except Exception as e:
        conn.rollback()
        print(f"❌ Transaction failed: {str(e)}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    run_gemini_pipeline()