import os
import numpy as np
import chromadb
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# Load database credentials from your project's environmental variables (.env)
load_dotenv()

def run_chroma_to_pgvector_migration():
    print("📦 Step 1: Initializing local ChromaDB persistent engine...")
    # Targets your live vector storage folder configuration
    chroma_client = chromadb.PersistentClient(path="./chroma_db")
    
    try:
        collection = chroma_client.get_collection(name="sap_bids_collection")
    except Exception as e:
        print(f"❌ Error: Could not locate 'sap_bids_collection' inside your ChromaDB directory: {str(e)}")
        return

    print("📥 Step 2: Fetching documents, metadata dictionaries, and vector arrays...")
    db_data = collection.get(include=["documents", "metadatas", "embeddings"])
    
    documents = db_data.get("documents", [])
    metadatas = db_data.get("metadatas", [])
    embeddings = db_data.get("embeddings", [])
    
    total_records = len(documents)
    print(f"📋 Extraction complete. Found {total_records} vector blocks staged for migration.")
    
    if total_records == 0:
        print("⚠️ Warning: ChromaDB source collection contains 0 records. Process stopped.")
        return

    # Database configuration parameters
    db_password = os.getenv("DB_PASSWORD")
    if not db_password:
        print("❌ Error: DB_PASSWORD environment variable is missing from your .env file.")
        return

    print("🔌 Step 3: Establishing connection to active PostgreSQL instance...")
    conn = psycopg2.connect(
        dbname="rfp_tracker_db",
        user="postgres",
        password=db_password,
        host="localhost",
        port="5432"
    )
    cursor = conn.cursor()

    try:
        # Enforce extension activation inside targeted database
        print("🛠️  Step 4: Activating pgvector extension natively in PostgreSQL...")
        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        
        # Drop the old 1536-dimensional placeholder table to prevent a dimension conflict
        print("🧼 Dropping old table structure to clear configuration...")
        cursor.execute("DROP TABLE IF EXISTS master_knowledge_base;")
        
        # Build master target knowledge base table matching your precise 384-dimension vector schema
        print("🏗️  Rebuilding 'master_knowledge_base' with exact 384-dimension layout...")
        cursor.execute("""
            CREATE TABLE master_knowledge_base (
                id SERIAL PRIMARY KEY,
                text_content TEXT NOT NULL,
                folder_source TEXT,
                file_source TEXT,
                vector_embedding vector(384) -- Matched perfectly to your data footprint
            );
        """)
        conn.commit()
        print("✅ Target table 'master_knowledge_base' is synchronized and ready.")

        print("🧱 Step 5: Formatting array elements into high-speed relational payloads...")
        migration_payload = []
        for i in range(total_records):
            text = documents[i]
            meta = metadatas[i] if metadatas and metadatas[i] else {}
            
            # Pull file-level metrics securely from your Chroma metadata block
            folder_path = meta.get("folder_path", "Unknown Legacy Folder")
            file_name = meta.get("file_name", "Unknown Origin File")
            raw_vector = embeddings[i]
            
            # Formats numpy dimensional values safely into standard Python float lists
            if isinstance(raw_vector, np.ndarray):
                vector_list = raw_vector.tolist()
            else:
                vector_list = list(raw_vector)
                
            migration_payload.append((text, folder_path, file_name, vector_list))

        print("🚀 Step 6: Initializing bulk streaming insert operations...")
        insert_query = """
            INSERT INTO master_knowledge_base (text_content, folder_source, file_source, vector_embedding)
            VALUES %s;
        """
        
        # Uses standard high-efficiency 2000-row block sizes to process records in seconds
        batch_size = 2000
        for offset in range(0, total_records, batch_size):
            batch = migration_payload[offset : offset + batch_size]
            execute_values(cursor, insert_query, batch)
            print(f"   🔹 Streamed batch items {offset} to {min(offset + batch_size, total_records)} successfully.")
            
        conn.commit()
        print(f"\n✨ Success! All {total_records} records have migrated to pgvector ('master_knowledge_base').")
        
    except Exception as trans_err:
        conn.rollback()
        print(f"❌ Critical Exception during structural pipeline execution: {str(trans_err)}")
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    run_chroma_to_pgvector_migration()