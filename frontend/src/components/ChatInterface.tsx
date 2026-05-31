"use client";

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Paperclip, Bot, User, X, Loader2, Volume2, VolumeX, Mic, MicOff, Wifi, HardDrive, Trash2 } from 'lucide-react';
import axios from 'axios';

type Message = {
  id: string;
  role: 'user' | 'bot';
  content: string;
};

type Mode = 'chat' | 'interview';
type Provider = 'offline' | 'online';

type ChatResponse = {
  reply: string;
};

type ResumeResponse = {
  analysis: string;
  extracted_text: string;
};

type InterviewResponse = {
  question: string;
  feedback?: string | null;
  finished: boolean;
};

const DEFAULT_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'bot',
    content: 'Hi! I am Lumina AI, your Engineering Assistant. I can help with placements, study, and interview preparation. Upload your resume to start an interview simulation!'
  }
];

const HISTORY_STORAGE_KEY = 'lumina-chat-history';
const SESSION_STORAGE_KEY = 'lumina-session-id';
const PROVIDER_STORAGE_KEY = 'lumina-provider';

function loadStoredMessages(): Message[] {
  if (typeof window === 'undefined') return DEFAULT_MESSAGES;

  try {
    const saved = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!saved) return DEFAULT_MESSAGES;
    const parsed = JSON.parse(saved) as Message[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_MESSAGES;
  } catch {
    return DEFAULT_MESSAGES;
  }
}

function loadStoredSessionId(): string {
  if (typeof window === 'undefined') return Math.random().toString(36).substring(7);

  const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (saved) return saved;

  const nextSessionId = Math.random().toString(36).substring(7);
  window.localStorage.setItem(SESSION_STORAGE_KEY, nextSessionId);
  return nextSessionId;
}

function loadStoredProvider(): Provider {
  if (typeof window === 'undefined') return 'offline';
  return window.localStorage.getItem(PROVIDER_STORAGE_KEY) === 'online' ? 'online' : 'offline';
}

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>(DEFAULT_MESSAGES);
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('chat');
  const [provider, setProvider] = useState<Provider>('offline');
  const [isTTSOn, setIsTTSOn] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimResult, setInterimResult] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const lastSpokenIdRef = useRef<string | null>('1');
  const sessionIdRef = useRef('default');
  const hasLoadedStorageRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const storedMessages = loadStoredMessages();
    const storedProvider = loadStoredProvider();
    sessionIdRef.current = loadStoredSessionId();
    hasLoadedStorageRef.current = true;

    window.requestAnimationFrame(() => {
      setMessages(storedMessages);
      setProvider(storedProvider);
    });
  }, []);

  useEffect(() => {
    if (!hasLoadedStorageRef.current) return;
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (!hasLoadedStorageRef.current) return;
    window.localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
  }, [provider]);

  // Handle voice synthesis loading
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const speechWindow = window as SpeechRecognitionWindow;
      const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event) => {
          let finalTranscript = '';
          let currentInterim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              currentInterim += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setInput(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + finalTranscript);
          }
          setInterimResult(currentInterim);
        };
        
        recognitionRef.current.onerror = (event) => {
          console.error('Speech recognition error', event.error);
          setIsListening(false);
        };
        
        recognitionRef.current.onend = () => {
          setIsListening(false);
          setInterimResult('');
        };
      }
    }
  }, []);

  // Trigger speech when a new bot message arrives
  useEffect(() => {
    if (!isTTSOn || typeof window === 'undefined' || !window.speechSynthesis) return;
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'bot' && lastMessage.id !== lastSpokenIdRef.current) {
      lastSpokenIdRef.current = lastMessage.id;
      
      window.speechSynthesis.cancel();
      const cleanText = lastMessage.content.replace(/[*_#`]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Samantha'))) || voices.find(v => v.lang.startsWith('en')) || voices[0];
      
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    }
  }, [messages, isTTSOn]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
        return;
      }
      setInterimResult('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const clearHistory = () => {
    setMessages(DEFAULT_MESSAGES);
    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
  };

  const handleSend = async () => {
    if (!input.trim() && !file) return;

    if (isListening) toggleListening(); // Auto stop listening when sending

    const userMessage = input;
    setInput('');
    setIsLoading(true);

    if (userMessage) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMessage }]);
    }

    try {
      if (file) {
        // Resume Upload Flow
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', content: 'Analyzing your resume...' }]);
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('provider', provider);
        if (userMessage) formData.append('text', userMessage);

        const res = await axios.post<ResumeResponse>('/api/resume', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        const analysis = res.data.analysis;
        const extractedText = res.data.extracted_text;
        
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = analysis;
          return newMessages;
        });

        // Auto start interview based on resume
        setMode('interview');
        const interviewRes = await axios.post<InterviewResponse>('/api/interview', {
          session_id: sessionIdRef.current,
          topic: `Resume based interview. Here is the resume content: ${extractedText.substring(0, 500)}`,
          reset: true,
          provider
        });

        const replyMsg = `**Interview Mode Started based on your Resume!**\n\nQuestion 1: ${interviewRes.data.question}`;
        setMessages(prev => [...prev, { 
          id: Date.now().toString(), 
          role: 'bot', 
          content: replyMsg 
        }]);
        
        setFile(null);
      } else {
        if (mode === 'chat') {
          const res = await axios.post<ChatResponse>('/api/chat', {
            message: userMessage,
            session_id: sessionIdRef.current,
            provider,
            history: messages.slice(-12).map(({ role, content }) => ({ role, content }))
          });
          const replyText = res.data.reply;
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', content: replyText }]);
        } else if (mode === 'interview') {
          const res = await axios.post<InterviewResponse>('/api/interview', {
            message: userMessage,
            session_id: sessionIdRef.current,
            reset: false,
            provider
          });
          
          let botReply = '';
          if (res.data.feedback) {
            botReply += `**Feedback:**\n${res.data.feedback}\n\n---\n\n`;
          }
          botReply += `**Next Question:**\n${res.data.question}`;
          
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', content: botReply }]);
          
          if (res.data.finished) {
            setMode('chat');
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', content: "**Exited interview mode.** How can I help you now?" }]);
          }
        }
      }
    } catch (error) {
      console.error(error);
      const errorMsg = 'Sorry, I encountered an error. Please try again.';
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', content: errorMsg }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-toolbar">
        <div className="provider-toggle" aria-label="AI provider">
          <button
            className={provider === 'offline' ? 'active' : ''}
            onClick={() => setProvider('offline')}
            type="button"
            title="Use local Ollama"
          >
            <HardDrive size={16} />
            <span>Offline</span>
          </button>
          <button
            className={provider === 'online' ? 'active' : ''}
            onClick={() => setProvider('online')}
            type="button"
            title="Use Groq online"
          >
            <Wifi size={16} />
            <span>Online</span>
          </button>
        </div>
        <button className="history-btn" onClick={clearHistory} type="button" title="Clear chat history">
          <Trash2 size={16} />
          <span>Clear history</span>
        </button>
      </div>
      <div className="messages">
        {messages.map((m) => (
          <div key={m.id} className={`message ${m.role}`}>
            <div className="avatar">
              {m.role === 'user' ? <User size={20} /> : <Bot size={20} />}
            </div>
            <div className="bubble markdown-content">
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message bot">
            <div className="avatar"><Bot size={20} /></div>
            <div className="bubble typing-indicator">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <div style={{ width: '100%', maxWidth: '900px', display: 'flex', flexDirection: 'column' }}>
          {file && (
            <div className="file-badge">
              <Paperclip size={14} />
              <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </span>
              <button className="remove-file" onClick={() => setFile(null)}>
                <X size={14} />
              </button>
            </div>
          )}
          
          {isListening && (
            <div style={{ marginBottom: '0.5rem', color: '#8a2be2', fontSize: '0.9rem', fontStyle: 'italic', paddingLeft: '1rem' }}>
              {interimResult ? `Listening: ${interimResult}...` : 'Listening... Start speaking.'}
            </div>
          )}
          
          <div className="input-container">
            <button 
              className="upload-btn" 
              onClick={() => {
                setIsTTSOn(!isTTSOn);
                if (isTTSOn && typeof window !== 'undefined' && window.speechSynthesis) {
                  window.speechSynthesis.cancel();
                }
              }} 
              title={isTTSOn ? "Mute Voice Response" : "Enable Voice Response"}
              style={{ color: isTTSOn ? '#8a2be2' : '#888' }}
            >
              {isTTSOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            
            <button 
              className="upload-btn" 
              onClick={toggleListening} 
              title={isListening ? "Stop Microphone" : "Use Microphone"}
              style={{ color: isListening ? '#ef4444' : '#888' }}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileChange}
              accept=".pdf,.txt"
            />
            <button className="upload-btn" onClick={() => fileInputRef.current?.click()} title="Upload Resume">
              <Paperclip size={20} />
            </button>
            <textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === 'chat' ? "Ask about engineering or upload resume..." : "Type your answer..."}
              rows={Math.min(5, input.split('\n').length)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button className="send-btn" onClick={handleSend} disabled={isLoading || (!input.trim() && !file)}>
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.8rem', color: '#666' }}>
            {mode === 'interview' ? (
              <>
                Interview Mode Active | <button style={{color: '#8a2be2', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline'}} onClick={() => setMode('chat')}>Exit Interview</button>
              </>
            ) : 'Lumina AI - Engineering Assistant'}
          </div>
        </div>
      </div>
    </div>
  );
}
