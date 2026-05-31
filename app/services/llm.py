import json
import urllib.request
import urllib.error

from app.config import get_settings

class OllamaService:
    def __init__(self):
        settings = get_settings()
        self.host = settings.ollama_host
        self.text_model = settings.ollama_model
        self.embed_model = settings.ollama_embed_model
        self.groq_host = settings.groq_host.rstrip("/")
        self.groq_model = settings.groq_model
        self.groq_api_key = settings.groq_api_key

    def generate(self, prompt: str, use_search: bool = False, provider: str = "offline") -> str:
        if provider == "online":
            return self._generate_groq(prompt)
        return self._generate_ollama(prompt)

    def _generate_ollama(self, prompt: str) -> str:
        url = f"{self.host}/api/generate"
        data = {
            "model": self.text_model,
            "prompt": prompt,
            "stream": False
        }
        req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode("utf-8"))
                return result.get("response", "")
        except urllib.error.URLError as e:
            # Let's try to pull the model if it's missing (Ollama will return 404 for missing model usually, but URLError catches HTTP errors)
            if hasattr(e, 'code') and e.code == 404:
                raise RuntimeError(f"Model '{self.text_model}' not found in Ollama. Please run 'ollama run {self.text_model}' in your terminal.")
            raise RuntimeError(f"Ollama generation failed: {e}. Is Ollama running?")

    def _generate_groq(self, prompt: str) -> str:
        if not self.groq_api_key:
            raise RuntimeError("Groq API key is missing. Add GROQ_API_KEY to your .env file.")

        url = f"{self.groq_host}/chat/completions"
        data = {
            "model": self.groq_model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            "temperature": 0.3,
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.groq_api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "Lumina-AI/1.0",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=90) as response:
                result = json.loads(response.read().decode("utf-8"))
                choices = result.get("choices", [])
                if not choices:
                    raise RuntimeError("Groq returned no choices.")
                return choices[0].get("message", {}).get("content", "")
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Groq generation failed: HTTP {e.code}. {detail}") from e
        except urllib.error.URLError as e:
            raise RuntimeError(f"Groq generation failed: {e}. Check your internet connection.") from e

    def get_embedding(self, text: str) -> list[float]:
        url = f"{self.host}/api/embeddings"
        data = {
            "model": self.embed_model,
            "prompt": text
        }
        req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode("utf-8"))
                return result.get("embedding", [])
        except urllib.error.URLError as e:
            if hasattr(e, 'code') and e.code == 404:
                 print(f"Embedding model '{self.embed_model}' not found in Ollama. Please run 'ollama pull {self.embed_model}' in your terminal.")
            else:
                 print(f"Error getting embedding from Ollama: {e}")
            return []

llm_service = OllamaService()
