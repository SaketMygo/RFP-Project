import os
import re
import json
import requests
from google import genai
from google.genai import types

class AIModelMiddleware:
    def __init__(self):
        # Load API keys from environment (prioritizing paid GEMINI_API_KEY_1 first)
        self.gemini_keys = []
        paid_key = os.getenv("GEMINI_API_KEY_1")
        if paid_key:
            self.gemini_keys.append(paid_key)
            
        primary_key = os.getenv("GEMINI_API_KEY")
        if primary_key and primary_key not in self.gemini_keys:
            self.gemini_keys.append(primary_key)
            
        for i in range(2, 10):
            k = os.getenv(f"GEMINI_API_KEY_{i}")
            if k and k not in self.gemini_keys:
                self.gemini_keys.append(k)
        
        self.gemini_key = self.gemini_keys[0] if self.gemini_keys else None
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.anthropic_key = os.getenv("CLAUDE_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
        self.deepseek_key = os.getenv("DEEPSEEK_API_KEY")
        self.groq_key = os.getenv("GROQ_API_KEY")
        self.ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")

        # Initialize primary genai client if primary key is available
        self.gemini_client = None
        if self.gemini_key:
            try:
                self.gemini_client = genai.Client(api_key=self.gemini_key)
            except Exception as e:
                print(f"Error initializing Gemini Client in middleware: {e}")

    def generate_response(self, prompt: str, system_instruction: str = None, model_name: str = "gemini/gemini-2.5-flash", response_format: str = "text", use_grounding: bool = True):
        """
        Generates a response from the selected model.
        model_name can be in format: 'provider/model-name' or just 'model-name'.
        """
        # Parse provider and model
        provider = "gemini"
        actual_model = model_name
        
        if "/" in model_name:
            provider, actual_model = model_name.split("/", 1)
        else:
            # Heuristics for provider if not explicitly given
            model_lower = model_name.lower()
            if "gpt" in model_lower:
                provider = "openai"
            elif "claude" in model_lower:
                provider = "anthropic"
            elif "deepseek" in model_lower:
                provider = "deepseek"
            elif "llama" in model_lower:
                provider = "ollama"
 
        provider = provider.lower()
        print(f"[AI Middleware] Route to Provider: {provider}, Model: {actual_model}, Format: {response_format}")
 
        try:
            if provider == "gemini":
                return self._call_gemini(prompt, system_instruction, actual_model, response_format, use_grounding)
            elif provider == "openai":
                return self._call_openai(prompt, system_instruction, actual_model, response_format)
            elif provider == "anthropic":
                return self._call_anthropic(prompt, system_instruction, actual_model, response_format)
            elif provider == "deepseek":
                return self._call_deepseek(prompt, system_instruction, actual_model, response_format)
            elif provider == "ollama":
                return self._call_ollama(prompt, system_instruction, actual_model, response_format)
            else:
                # Fallback to Gemini if provider is unknown
                print(f"[AI Middleware] Unknown provider '{provider}', falling back to Gemini.")
                return self._call_gemini(prompt, system_instruction, "gemini-2.5-flash", response_format, use_grounding)
        except Exception as e:
            print(f"[AI Middleware] Error calling provider '{provider}': {e}")
            
            # Dynamic mutual fallback logic between Anthropic and Gemini
            if provider == "gemini":
                if self.anthropic_key:
                    try:
                        print("[AI Middleware] Gemini call failed/rate-limited. Falling back to Anthropic Claude...")
                        return self._call_anthropic(prompt, system_instruction, "claude-sonnet-5", response_format)
                    except Exception as anthropic_err:
                        print(f"[AI Middleware] Fallback to Anthropic also failed: {anthropic_err}")
            else:
                if self.gemini_key:
                    try:
                        print(f"[AI Middleware] Provider '{provider}' failed. Falling back to Gemini (gemini-2.5-flash-lite)...")
                        return self._call_gemini(prompt, system_instruction, "gemini-2.5-flash-lite", response_format, use_grounding=True)
                    except Exception as gemini_err:
                        print(f"[AI Middleware] Fallback to Gemini also failed: {gemini_err}")
            raise e
 
    def _call_gemini(self, prompt, system_instruction, model, response_format, use_grounding=True):
        if not self.gemini_keys:
            raise ValueError("No Gemini API Keys found. Please define GEMINI_API_KEY or GEMINI_API_KEY_1/2/3/4 in your .env file.")
        
        config_args = {}
        if system_instruction:
            config_args["system_instruction"] = system_instruction
        
        if response_format == "json":
            config_args["response_mime_type"] = "application/json"
            
        # Enable search grounding (using the internet) as a tool if requested and compatible
        if use_grounding and response_format != "json":
            config_args["tools"] = [types.Tool(google_search=types.GoogleSearch())]
            
        config = types.GenerateContentConfig(**config_args)
        
        # Map user UI model name to current active API identifier
        api_model = model
        if model in ["gemini-3-flash-preview", "gemini-3.5-flash"]:
            api_model = "gemini-2.5-flash"
        elif model in ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite"]:
            api_model = "gemini-2.5-flash-lite"
            
        # Try keys in order (paid key GEMINI_API_KEY_1 first), do not shuffle
        keys_to_try = list(self.gemini_keys)
        
        last_error = None
        # Try configured keys sequentially
        for idx, api_key in enumerate(keys_to_try, 1):
            try:
                orig_idx = self.gemini_keys.index(api_key) + 1 if api_key in self.gemini_keys else idx
                print(f"[AI Middleware] Invoking Gemini model '{api_model}' using Key #{orig_idx}...")
                client = genai.Client(api_key=api_key)
                response = client.models.generate_content(
                    model=api_model,
                    contents=prompt,
                    config=config
                )
                return response.text
            except Exception as e:
                err_str = str(e)
                print(f"[AI Middleware] Gemini Key #{idx} failed: {err_str}")
                # Check for rate limit (429) or service unavailable (503)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "503" in err_str or "500" in err_str:
                    print(f"[AI Middleware] Quota/Service limit hit on Key #{idx}. Rolling over to next backup key...")
                    last_error = e
                    continue
                else:
                    # Fail fast on other exceptions (like authentication errors or invalid parameters)
                    raise e
                    
        raise last_error or ValueError("All configured Gemini API keys failed to generate content.")

    def _call_openai(self, prompt, system_instruction, model, response_format):
        if not self.openai_key:
            raise ValueError("OPENAI_API_KEY is not configured in .env")
        
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.openai_key}",
            "Content-Type": "application/json"
        }
        
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})
        
        data = {
            "model": model,
            "messages": messages,
            "temperature": 0.1
        }
        
        if response_format == "json":
            data["response_format"] = {"type": "json_object"}
            
        try:
            response = requests.post(url, headers=headers, json=data, timeout=60)
            response.raise_for_status()
            res_json = response.json()
            return res_json["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"OpenAI API error: {e}")
            raise

    def _call_anthropic(self, prompt, system_instruction, model, response_format):
        if not self.anthropic_key:
            raise ValueError("ANTHROPIC_API_KEY is not configured in .env")
        
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.anthropic_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        }
        
        # Map user UI model name to current active Anthropic API identifier
        api_model = model
            
        data = {
            "model": api_model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 4000
        }
        
        if system_instruction:
            data["system"] = system_instruction
            
        try:
            response = requests.post(url, headers=headers, json=data, timeout=60)
            if response.status_code != 200:
                print(f"Anthropic API Error Details: Status {response.status_code}, Body: {response.text}")
            response.raise_for_status()
            res_json = response.json()
            for block in res_json.get("content", []):
                if block.get("type") == "text" and "text" in block:
                    return block["text"]
            
            # Fallback if no text block matches
            if res_json.get("content") and "text" in res_json["content"][0]:
                return res_json["content"][0]["text"]
            raise KeyError("No text block found in Anthropic response content list")
        except Exception as e:
            print(f"Anthropic API error: {e}")
            raise

    def _call_deepseek(self, prompt, system_instruction, model, response_format):
        key = self.deepseek_key or self.openai_key
        if not key:
            raise ValueError("DEEPSEEK_API_KEY is not configured in .env")
            
        url = "https://api.deepseek.com/chat/completions"
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
        
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})
        
        data = {
            "model": model,
            "messages": messages,
            "temperature": 0.1
        }
        
        if response_format == "json":
            data["response_format"] = {"type": "json_object"}
            
        try:
            response = requests.post(url, headers=headers, json=data, timeout=60)
            response.raise_for_status()
            res_json = response.json()
            return res_json["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"DeepSeek API error: {e}")
            raise

    def _call_ollama(self, prompt, system_instruction, model, response_format):
        url = f"{self.ollama_host}/api/chat"
        
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})
        
        data = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.1
            }
        }
        
        if response_format == "json":
            data["format"] = "json"
            
        try:
            response = requests.post(url, json=data, timeout=120)
            response.raise_for_status()
            res_json = response.json()
            return res_json["message"]["content"]
        except Exception as e:
            print(f"Ollama local API error: {e}")
            raise
