import re
import os
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import chromadb
from sklearn.manifold import TSNE

# 1. CONNECT TO YOUR FRESH CHROMADB
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_collection(name="sap_bids_collection")

print("📦 Fetching all embedded chunks from your new master ChromaDB...")
db_data = collection.get(include=["documents", "metadatas", "embeddings"])

documents = db_data["documents"]
metadatas = db_data["metadatas"]
embeddings = np.array(db_data["embeddings"])

if len(documents) == 0:
    print("❌ The database appears to be empty. Ensure you point to the correct 'chroma_db' directory.")
    exit()

print(f"✅ Successfully pulled {len(documents)} database items.")

# ---------------------------------------------------------------------------
# 2. EXTRACT CORE KEYWORDS FOR MAP LABELS
# ---------------------------------------------------------------------------
print("🔤 Extracting top keywords from text chunks...")
def get_top_keywords(text, num_keywords=3):
    # Pull out alphanumeric words/codes (like S4HANA, FICO, EWM, RFI)
    words = re.findall(r'\b[A-Za-z0-9/]{3,12}\b', text.upper())
    ignore = {'AND', 'THE', 'FOR', 'WITH', 'THIS', 'THAT', 'FROM', 'DOCUMENT', 'FOLDER', 'SHEET', 'ROW', 'PAGE', 'CATEGORY', 'ACTIVE', 'BIDS'}
    filtered_words = [w for w in words if w not in ignore]
    
    unique_words = []
    for w in filtered_words:
        if w not in unique_words:
            unique_words.append(w)
        if len(unique_words) == num_keywords:
            break
    return ", ".join(unique_words) if unique_words else "Data Chunk"

# ---------------------------------------------------------------------------
# 3. COMPRESS VECTORS TO A 2D MAP (Optimized for 20k+ Items)
# ---------------------------------------------------------------------------
print("🧩 Compressing vector dimensions down to 2D...")

# With 20,350 items, pure t-SNE is incredibly slow. 
# We sub-sample up to 3,000 points randomly for a lightning-fast, clean visual representation.
MAX_VISUAL_POINTS = 3000
total_chunks = len(documents)

if total_chunks > MAX_VISUAL_POINTS:
    print(f"⚡ Dataset is large ({total_chunks} chunks). Sampling {MAX_VISUAL_POINTS} random points for high-speed rendering...")
    np.random.seed(42)
    sample_indices = np.random.choice(total_chunks, size=MAX_VISUAL_POINTS, replace=False)
    
    # Filter our plotting arrays down to the sampled subset
    embeddings_subset = embeddings[sample_indices]
    documents_subset = [documents[i] for i in sample_indices]
    metadatas_subset = [metadatas[i] for i in sample_indices]
else:
    embeddings_subset = embeddings
    documents_subset = documents
    metadatas_subset = metadatas

# Initialize t-SNE without the outdated 'n_iter' argument
tsne = TSNE(n_components=2, random_state=42, perplexity=30)
embeddings_2d = tsne.fit_transform(embeddings_subset)

# Extract top-level folder categories for color-coding based on our plotted subset
folder_labels = [meta.get("folder_path", "Root").split('\\')[0] for meta in metadatas_subset]
unique_folders = list(set(folder_labels))

# ---------------------------------------------------------------------------
# 4. PLOT THE VECTOR SPACE
# ---------------------------------------------------------------------------
print("🎨 Generating data cluster visualization map...")
plt.figure(figsize=(16, 10))
sns.set_theme(style="whitegrid")

# Create a distinct color palette for your primary subfolders
palette = sns.color_palette("bright", len(unique_folders))

for i, folder in enumerate(unique_folders):
    indices = [idx for idx, label in enumerate(folder_labels) if label == folder]
    
    plt.scatter(
        embeddings_2d[indices, 0],
        embeddings_2d[indices, 1],
        label=folder,
        alpha=0.7,
        edgecolors='none',
        s=30
    )

# Annotate a random selection of points to see what kind of text lives where
np.random.seed(42)
sample_size = min(15, len(documents_subset))
annotation_indices = np.random.choice(len(documents_subset), size=sample_size, replace=False)
for idx in annotation_indices:
    keywords = get_top_keywords(documents_subset[idx])
    plt.annotate(
        f"[{keywords}]",
        (embeddings_2d[idx, 0], embeddings_2d[idx, 1]),
        textcoords="offset points",
        xytext=(5, 5),
        fontsize=8,
        weight='bold',
        alpha=0.8,
        bbox=dict(boxstyle="round,pad=0.2", fc="yellow", alpha=0.4, ec="orange")
    )

plt.title("RFP Master Database: RAG Vector Clusters\n(Semantic Mapping of Entire '01-RFPs-RFIs-RFQs' Directory)", fontsize=16, pad=15)
plt.xlabel("Semantic Dimension X", fontsize=12)
plt.ylabel("Semantic Dimension Y", fontsize=12)

# Position legend on the side so it doesn't overlap data points
plt.legend(title="Top-Level Folders", bbox_to_anchor=(1.02, 1), loc='upper left', borderaxespad=0)
plt.tight_layout()

output_image = "master_rag_visualization.png"
plt.savefig(output_image, dpi=300)
print(f"✨ Success! Your visualization map is saved as: '{output_image}'")
plt.show()