import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from dotenv import load_dotenv

# Load environment variables from the .env file
load_dotenv()

def initialize_postgres_tables():
    # ---------------------------------------------------------------------------
    # CONFIGURATION: Pulls the password securely from your .env file
    # ---------------------------------------------------------------------------
    target_db = os.getenv("DB_NAME", "rfp_tracker_db")
    db_password = os.getenv("DB_PASSWORD")
    db_user = os.getenv("DB_USER", "postgres")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")

    if not db_password:
        print("❌ Error: DB_PASSWORD not found in .env file. Please check your environment setup.")
        return

    # STEP 1: Connect to default 'postgres' database to ensure our target DB exists
    try:
        base_conn = psycopg2.connect(
            dbname="postgres",
            user=db_user,
            password=db_password,
            host=db_host,
            port=db_port
        )
        base_conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        base_cursor = base_conn.cursor()

        # Check if our specific database exists
        base_cursor.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{target_db}';")
        exists = base_cursor.fetchone()
        
        if not exists:
            print(f"🛠️ Database '{target_db}' does not exist. Creating it now...")
            base_cursor.execute(f"CREATE DATABASE {target_db};")
            print(f"✅ Database '{target_db}' created successfully.")
        else:
            print(f"📚 Database '{target_db}' found.")
            
        base_cursor.close()
        base_conn.close()

    except Exception as e:
        print(f"❌ Failed during database check/creation phase: {str(e)}")
        return

    # STEP 2: Connect directly to the newly verified/created rfp_tracker_db to deploy tables
    try:
        conn = psycopg2.connect(
            dbname=target_db,
            user=db_user,
            password=db_password,
            host=db_host,
            port=db_port
        )
        cursor = conn.cursor()
        print(f"🔌 Connected to PostgreSQL target database '{target_db}' successfully.")

        # ---------------------------------------------------------------------------
        # TABLE 1: BIDS & TIMELINES (Requirements 4, 5, 8a, 13, 14)
        # ---------------------------------------------------------------------------
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS bids (
            bid_id SERIAL PRIMARY KEY,
            bid_name VARCHAR(255) NOT NULL UNIQUE,
            folder_path TEXT NOT NULL,
            bid_manager VARCHAR(100) NOT NULL,
            overall_status VARCHAR(50) DEFAULT 'Active', -- Active, Management Approval, Ready to Ship, Bid Submitted, Won, Lost, Revisions
            disqualification_reason TEXT,
            complexity VARCHAR(10) DEFAULT 'Medium',    -- High, Medium, Low
            qualification_status VARCHAR(20) DEFAULT 'Pending', -- Qualified, Not Qualified
            
            -- Dynamic Timeline Engine Dates
            bid_received_date DATE NOT NULL,
            bid_submission_date DATE NOT NULL,
            draft_bid_proposal_date DATE NOT NULL,       -- Received + 3 days
            sme_review_due_date DATE NOT NULL,           -- Draft + 3 days
            management_approval_date DATE NOT NULL,      -- Submission - 2 days
            actual_submission_date DATE,
            
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # ---------------------------------------------------------------------------
        # TABLE 2: STRUCTURAL BID WORKSPACE ROWS (Requirements 3, 6, 7, 8b, 8c)
        # ---------------------------------------------------------------------------
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS requirements (
            id SERIAL PRIMARY KEY,
            bid_id INT REFERENCES bids(bid_id) ON DELETE CASCADE,
            requirement_id_source VARCHAR(100),         -- Serial number or ID from source
            section_tab VARCHAR(50) NOT NULL,            -- Qualification, Functional, Technical, Compliance, Attachments, Approvals
            source_document VARCHAR(255) NOT NULL,
            source_sheet_tab VARCHAR(100),               -- Specific excel tab source if applicable
            question_text TEXT NOT NULL,
            sap_module VARCHAR(100),                     -- Relevant module (e.g., FICO, MM, SD)
            assigned_sme VARCHAR(100),
            
            -- Response & Verification Tracking
            fitment_score VARCHAR(50) DEFAULT 'Need Further Info', -- Full Compliance, Partial, Does not support, need further info
            ai_generated_response TEXT,
            ai_sources_listed TEXT,                      -- Traceable links/files
            manual_override_response TEXT,
            
            -- Validation Workflow States
            sme_status VARCHAR(50) DEFAULT 'Pending',    -- Pending, Approved, Rejected
            flagged_for_management BOOLEAN DEFAULT FALSE,
            
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # ---------------------------------------------------------------------------
        # TABLE 3: CORE DOCUMENT REPOSITORY & CERTIFICATES (Requirements 16c, 16d)
        # ---------------------------------------------------------------------------
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS corporate_assets (
            asset_id SERIAL PRIMARY KEY,
            asset_type VARCHAR(50) NOT NULL,             -- Certificate, Resource Count, Company Info
            asset_name VARCHAR(255) NOT NULL,            -- e.g., 'CMMI Certification', 'ISO 9001'
            issuing_entity VARCHAR(255),
            validity_start DATE,
            validity_end DATE,
            meta_details TEXT                            -- Resource skills counts or location metrics
        );
        """)

        # ---------------------------------------------------------------------------
        # TABLE 4: TARGET APPROVERS CONFIGURATION (Requirement 4)
        # ---------------------------------------------------------------------------
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS bid_approvers (
            approval_id SERIAL PRIMARY KEY,
            bid_id INT REFERENCES bids(bid_id) ON DELETE CASCADE,
            approval_level INT NOT NULL,                 -- e.g., Level 1, Level 2
            approver_name VARCHAR(100) NOT NULL,
            approval_status VARCHAR(50) DEFAULT 'Pending'
        );
        """)

        conn.commit()
        print("✨ All PostgreSQL architecture tables deployed successfully using secure environment configurations.")

    except Exception as e:
        print(f"❌ PostgreSQL database initialization failed: {str(e)}")
    finally:
        if 'conn' in locals() and conn:
            cursor.close()
            conn.close()

if __name__ == "__main__":
    initialize_postgres_tables()