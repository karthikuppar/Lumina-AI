import json
import math
import os
from typing import TypedDict

from app.services.llm import llm_service


class MemoryItem(TypedDict):
    text: str
    embedding: list[float]


class VectorMemory:
    def __init__(self, filepath: str = "memory.json"):
        self.filepath = filepath
        self.memories: list[MemoryItem] = []
        self._load()

    def _load(self):
        if os.path.exists(self.filepath):
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    self.memories = json.load(f)
            except json.JSONDecodeError:
                self.memories = []

    def _save(self):
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(self.memories, f)

    def _get_embedding(self, text: str) -> list[float]:
        try:
            return llm_service.get_embedding(text)
        except Exception as e:
            print(f"Error getting embedding: {e}")
            return []

    def _cosine_similarity(self, vec1: list[float], vec2: list[float]) -> float:
        if not vec1 or not vec2 or len(vec1) != len(vec2):
            return 0.0
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = math.sqrt(sum(a * a for a in vec1))
        norm2 = math.sqrt(sum(b * b for b in vec2))
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return dot_product / (norm1 * norm2)

    def add_memory(self, text: str):
        embedding = self._get_embedding(text)
        if embedding:
            self.memories.append({"text": text, "embedding": embedding})
            self._save()

    def search_memory(self, query: str, top_k: int = 3) -> list[str]:
        if not self.memories:
            return []
            
        query_embedding = self._get_embedding(query)
        if not query_embedding:
            return []

        scored_memories = []
        for mem in self.memories:
            score = self._cosine_similarity(query_embedding, mem["embedding"])
            scored_memories.append((score, mem["text"]))

        # Sort by highest score first
        scored_memories.sort(reverse=True, key=lambda x: x[0])
        
        # Filter memories with a reasonable threshold (e.g. > 0.6)
        return [text for score, text in scored_memories[:top_k] if score > 0.6]

memory_db = VectorMemory()
