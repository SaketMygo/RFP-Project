import os
import psycopg2
from dotenv import load_dotenv

# Load credentials from .env
load_dotenv()

def smart_extract_unknown_sources():
    db_password = os.getenv("DB_PASSWORD")
    if not db_password:
        print("❌ Error: Missing DB_PASSWORD in .env file.")
        return

    # 1. Connect to PostgreSQL
    conn = psycopg2.connect(
        dbname="rfp_tracker_db",
        user="postgres",
        password=db_password,
        host="localhost",
        port="5432"
    )
    cursor = conn.cursor()

    print("🔍 Fetching rows marked with 'Unknown Origin File'...")
    cursor.execute("""
        SELECT id, text_content 
        FROM master_knowledge_base 
        WHERE file_source = 'Unknown Origin File';
    """)
    broken_rows = cursor.fetchall()
    
    if not broken_rows:
        print("✅ No rows found with 'Unknown Origin File'.")
        cursor.close()
        conn.close()
        return

    print(f"📋 Analyzing {len(broken_rows)} rows for embedded source titles...")
    print("⚡ Extracting metadata footprints...")

    updated_count = 0
    batch_updates = []

    for db_id, db_text in broken_rows:
        cleaned_text = db_text.strip()
        matched_title = None

        # Rule A: Extract from standard community/article footnotes
        if " - SAP Community" in cleaned_text:
            # Grabs the text before the dash as the title
            matched_title = cleaned_text.split(" - SAP Community")[0].strip() + "_SAP_Community.txt"
        elif ", https://www." in cleaned_text:
            # Grabs the website domain name as a clean reference
            domain_part = cleaned_text.split(", https://www.")[1].split("/")[0]
            matched_title = f"{domain_part}_Web_Scrape.txt"
        elif "Diskover → SAP IBP" in cleaned_text or "WP4 – Finance target picture" in cleaned_text:
            matched_title = "S4HANA_Transition_Assessment_Roadmap.txt"
        
        # Rule B: Fallback clean snippet title if no footnote domain exists
        if not matched_title and len(cleaned_text) > 0:
            # Takes the first 4-5 words of the chunk to construct a readable file identifier
            words = [w for w in cleaned_text.replace("\n", " ").split(" ") if w][:4]
            snippet_name = "_".join(words).replace(":", "").replace(".", "").replace(",", "")
            matched_title = f"Doc_{snippet_name}.txt"

        if matched_title:
            # Limit filename string size safely
            matched_title = matched_title[:100]
            batch_updates.append((matched_title, db_id))

    # 2. Push updates in optimized batches
    if batch_updates:
        print(f"🚀 Executing {len(batch_updates)} metadata updates in PostgreSQL...")
        cursor.executemany("""
            UPDATE master_knowledge_base
            SET file_source = %s
            WHERE id = %s;
        """, batch_updates)
        conn.commit()
        updated_count = len(batch_updates)

    print("=" * 70)
    print(f"🎉 SUCCESS! Smart extraction complete. Fixed {updated_count} rows.")
    print("=" * 70)
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    smart_extract_unknown_sources()