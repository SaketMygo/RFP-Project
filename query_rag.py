import chromadb
from chromadb.utils import embedding_functions

# 1. Connect to your existing local database folder
chroma_client = chromadb.PersistentClient(path="./chroma_db")

# 2. Initialize the exact same local embedding model
hf_embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

# 3. Get the collection we populated earlier
collection = chroma_client.get_or_create_collection(
    name="sap_bids_collection", 
    embedding_function=hf_embedding_fn
)

def search_sap_knowledge_base(query_text, num_results=3):
    print(f"\n🔍 Searching database for: '{query_text}'...")
    
    # Query ChromaDB
    results = collection.query(
        query_texts=[query_text],
        n_results=num_results
    )
    
    # Parse and present the results cleanly
    if not results or not results['documents'][0]:
        print("No matching records found.")
        return

    print(f"\n🎯 Found top {num_results} most relevant matches:\n" + "="*60)
    
    for i in range(len(results['documents'][0])):
        text = results['documents'][0][i]
        metadata = results['metadatas'][0][i]
        distance = results['distances'][0][i] # Lower means a closer geometric match
        
        print(f"Match #{i+1} (Confidence Score: {round(1 - distance, 3)})")
        print(f"📂 Folder Path:   {metadata.get('folder_path')}")
        print(f"📄 Source File:   {metadata.get('source_file')}")
        print(f"🏷️ Doc Type:     {metadata.get('document_type')}")
        if 'sheet_name' in metadata:
            print(f"📊 Excel Sheet:  {metadata.get('sheet_name')}")
        print("-" * 60)
        print(f"📝 TEXT EXTRACT:\n{text}")
        print("=" * 60 + "\n")

# ---------------------------------------------------------------------------
# TEST RUN
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Test Question 1: Looking for S/4HANA specific project material
    search_sap_knowledge_base("S4HANA PreStudy or project timeline requirements", num_results=2)
    
    # Test Question 2: Testing if our Excel parser can pull pricing/costs correctly
    # search_sap_knowledge_base("Cost Response Template pricing matrix numbers", num_results=2)

