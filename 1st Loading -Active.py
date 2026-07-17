import os
import pandas as pd
from docx import Document
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
import chromadb
from chromadb.utils import embedding_functions

# ---------------------------------------------------------------------------
# 1. SETUP LOCAL VECTOR DATABASE (CHROMADB)
# ---------------------------------------------------------------------------
# This creates a folder named 'chroma_db' in your current directory to store the data permanently
chroma_client = chromadb.PersistentClient(path="./chroma_db")

# Use SentenceTransformerEmbeddingFunction for 100% LOCAL execution (No API key needed)
hf_embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

# Create or get the collection where your SAP documents will live
collection = chroma_client.get_or_create_collection(
    name="sap_bids_collection", 
    embedding_function=hf_embedding_fn
)

# ---------------------------------------------------------------------------
# 2. PARSING FUNCTIONS FOR EACH FORMAT
# ---------------------------------------------------------------------------

def parse_docx(file_path):
    """Extracts text from Word documents."""
    try:
        doc = Document(file_path)
        content = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(content)
    except Exception as e:
        print(f"  ❌ Error reading Word file {file_path}: {e}")
        return ""

def parse_pdf(file_path):
    """Extracts raw text from PDFs page by page."""
    try:
        reader = PdfReader(file_path)
        content = []
        for page_num, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                content.append(text)
        return "\n\n".join(content)
    except Exception as e:
        print(f"  ❌ Error reading PDF file {file_path}: {e}")
        return ""

def parse_excel_to_chunks(file_path, file_name, relative_folder):
    """Reads Excel sheets and converts rows into contextual text chunks."""
    chunks = []
    try:
        xl = pd.ExcelFile(file_path)
        for sheet_name in xl.sheet_names:
            df = xl.parse(sheet_name)
            df.dropna(how='all', inplace=True)
            if df.empty:
                continue
                
            headers = [str(col).strip() for col in df.columns]
            
            for idx, row in df.iterrows():
                row_values = [str(val).strip() for val in row.values]
                row_items = [f"{headers[i]}: {row_values[i]}" for i in range(len(headers)) if row_values[i] != 'nan']
                row_string = ", ".join(row_items)
                
                chunk_text = f"Folder: {relative_folder} | Document: {file_name} | Sheet: {sheet_name} | Row {idx+1}: {row_string}"
                
                metadata = {
                    "source_file": file_name,
                    "folder_path": relative_folder,
                    "document_type": "RFQ/Excel",
                    "sheet_name": sheet_name
                }
                chunks.append({"text": chunk_text, "metadata": metadata})
    except Exception as e:
        print(f"  ❌ Error reading Excel file {file_path}: {e}")
    return chunks

# ---------------------------------------------------------------------------
# 3. RECURSIVE DIRECTORY TRAVERSAL & STORAGE
# ---------------------------------------------------------------------------

def ingest_directory_to_chroma(root_dir):
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=120)
    
    global_id_counter = 0
    total_files_processed = 0

    print(f"🚀 Starting recursive scan of: {root_dir}\n")

    # os.walk automatically goes into all subfolders deep in the tree
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Calculate a clean relative folder path for metadata tracking
        relative_folder = os.path.relpath(dirpath, root_dir)
        if relative_folder == ".":
            relative_folder = "Root"

        for file_name in filenames:
            file_path = os.path.join(dirpath, file_name)
            ext = os.path.splitext(file_name)[1].lower()
            
            # Infer document type based on path or filename
            doc_type = "Unknown"
            lower_path = file_path.lower()
            if "rfp" in lower_path: doc_type = "RFP"
            elif "rfq" in lower_path: doc_type = "RFQ"
            elif "rfi" in lower_path: doc_type = "RFI"

            base_metadata = {
                "source_file": file_name,
                "folder_path": relative_folder,
                "document_type": doc_type
            }

            # Lists to store chunks for this specific file before batch saving
            file_texts = []
            file_metadatas = []
            file_ids = []

            if ext == '.docx':
                print(f"Parsing Word: [{relative_folder}] -> {file_name}")
                raw_text = parse_docx(file_path)
                if raw_text:
                    chunks = text_splitter.split_text(raw_text)
                    for chunk in chunks:
                        file_texts.append(chunk)
                        file_metadatas.append(base_metadata)
                        file_ids.append(f"doc_{global_id_counter}")
                        global_id_counter += 1

            elif ext == '.pdf':
                print(f"Parsing PDF:  [{relative_folder}] -> {file_name}")
                raw_text = parse_pdf(file_path)
                if raw_text:
                    chunks = text_splitter.split_text(raw_text)
                    for chunk in chunks:
                        file_texts.append(chunk)
                        file_metadatas.append(base_metadata)
                        file_ids.append(f"doc_{global_id_counter}")
                        global_id_counter += 1

            elif ext in ['.xlsx', '.xls']:
                print(f"Parsing Excel:[{relative_folder}] -> {file_name}")
                excel_chunks = parse_excel_to_chunks(file_path, file_name, relative_folder)
                for chunk in excel_chunks:
                    # Update doc type to use inferred folder context if 'Unknown'
                    if chunk["metadata"]["document_type"] == "Unknown":
                        chunk["metadata"]["document_type"] = doc_type
                    file_texts.append(chunk["text"])
                    file_metadatas.append(chunk["metadata"])
                    file_ids.append(f"doc_{global_id_counter}")
                    global_id_counter += 1

            # If chunks were generated for the file, upsert them into ChromaDB
            if file_texts:
                collection.upsert(
                    documents=file_texts,
                    metadatas=file_metadatas,
                    ids=file_ids
                )
                total_files_processed += 1

    print(f"\n✅ Success! Processed {total_files_processed} files and added {global_id_counter} vector chunks to ChromaDB.")

# ---------------------------------------------------------------------------
# 4. EXECUTION
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Your target directory path
    root_directory = r"C:\Users\Saket Dronamraju\Desktop\RFP project\01-RFPs-RFIs-RFQs\Active Bids"
    
    if os.path.exists(root_directory):
        ingest_directory_to_chroma(root_directory)
    else:
        print(f"❌ Error: The directory path '{root_directory}' could not be found. Check your path string.")