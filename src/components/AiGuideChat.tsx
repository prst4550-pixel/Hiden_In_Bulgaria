import React, { useState, useRef, useEffect } from 'react';
import { Place, ChatMessage, User as UserProfile } from '../types';
import { sendGuideMessage } from '../services/api';
import { handleImageError } from '../utils/imageFallback';
import {
  Send,
  RotateCcw,
  Compass,
  ShieldAlert,
  Loader2,
  MapPin,
  User,
  Globe,
  ExternalLink,
  Sparkles,
  Camera,
  Image as ImageIcon,
  ArrowUpRight,
  Mountain,
  Sun,
  ShieldCheck,
  CheckCircle2,
  Info,
  X,
  UploadCloud,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RefreshCw,
  Phone,
  Hotel,
  Lock,
  LogIn,
  UserPlus,
} from 'lucide-react';

interface AiGuideChatProps {
  places: Place[];
  onSelectPlaceById: (id: string) => void;
  currentUser?: UserProfile | null;
  persistedMessages?: ChatMessage[];
  onPersistedMessagesChange?: (messages: ChatMessage[]) => void;
  onRequireAuth?: (
    message: string,
    action: (user: UserProfile) => void | Promise<void>,
    tab?: 'login' | 'register'
  ) => boolean;
}

export function createDefaultGuideWelcome(): ChatMessage {
  return {
    id: 'welcome',
    sender: 'guide',
    text: 'Здравейте! Аз съм Пътеводителят на „Скрито в България“ с директно търсене в Google в реално време.\n\nМожете да ме попитате за:\n• Хотели, къщи за гости и актуални цени за нощувки или входни билети;\n• Актуална прогноза за времето, снеговалежи и проходимост по маршрутите;\n• Скрити природни и исторически забележителности от каталога ни;\n• Разпознаване на обект по снимка от вашата камера или галерия!',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    modelUsed: 'Gemini 4 Hydrogen',
    suggestedPlaceIds: ['belintash', 'dyavolski-most', 'peshtera-prohodna'],
  };
}

function sanitizeExternalUrl(rawUri?: string): string | null {
  if (!rawUri) return null;
  try {
    const parsed = new URL(rawUri);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

function stripMarkdownSymbols(text: string): string {
  return String(text || '')
    .replace(/\*\*/g, '')
    .replace(/(^|[\s(])__([^_\n]+)__(?=[\s).,!?:;]|$)/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .trim();
}

function trimTrailingUrlPunctuation(rawUrl: string): { url: string; trailing: string } {
  let url = rawUrl;
  let trailing = '';
  while (url.length > 0) {
    const lastChar = url[url.length - 1];
    if ('.,;:!?'.includes(lastChar)) {
      trailing = lastChar + trailing;
      url = url.slice(0, -1);
      continue;
    }
    if (lastChar === ')') {
      const openCount = (url.match(/\(/g) || []).length;
      const closeCount = (url.match(/\)/g) || []).length;
      if (closeCount > openCount) {
        trailing = lastChar + trailing;
        url = url.slice(0, -1);
        continue;
      }
    }
    break;
  }
  return { url, trailing };
}

function renderMessageWithClickableLinks(rawText: string, isUser: boolean): React.ReactNode {
  const clean = stripMarkdownSymbols(rawText);
  if (!clean) return null;

  const linkRegex = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"'\]]+)/gi;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = linkRegex.exec(clean)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(clean.slice(lastIndex, match.index));
    }

    const mdLabel = match[1];
    const mdHref = match[2];
    const bareRaw = match[3];

    if (mdHref) {
      const safeHref = sanitizeExternalUrl(mdHref);
      if (safeHref) {
        nodes.push(
          <a
            key={`lnk-${keyCounter++}`}
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`inline underline underline-offset-2 font-semibold break-all transition-colors ${
              isUser
                ? 'text-amber-200 hover:text-amber-100 decoration-amber-300/70'
                : 'text-emerald-800 hover:text-emerald-950 decoration-emerald-700/60'
            }`}
          >
            {mdLabel || safeHref}
            <ExternalLink className="w-3 h-3 inline-block ml-1 align-baseline shrink-0" />
          </a>
        );
      } else {
        nodes.push(match[0]);
      }
    } else if (bareRaw) {
      const { url, trailing } = trimTrailingUrlPunctuation(bareRaw);
      const safeHref = sanitizeExternalUrl(url);
      if (safeHref) {
        nodes.push(
          <a
            key={`lnk-${keyCounter++}`}
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`inline underline underline-offset-2 font-semibold break-all transition-colors ${
              isUser
                ? 'text-amber-200 hover:text-amber-100 decoration-amber-300/70'
                : 'text-emerald-800 hover:text-emerald-950 decoration-emerald-700/60'
            }`}
          >
            {safeHref}
            <ExternalLink className="w-3 h-3 inline-block ml-1 align-baseline shrink-0" />
          </a>
        );
        if (trailing) {
          nodes.push(trailing);
        }
      } else {
        nodes.push(match[0]);
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < clean.length) {
    nodes.push(clean.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : clean;
}

export const AiGuideChat: React.FC<AiGuideChatProps> = ({
  places,
  onSelectPlaceById,
  currentUser,
  persistedMessages,
  onPersistedMessagesChange,
  onRequireAuth,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    persistedMessages && persistedMessages.length > 0
      ? persistedMessages
      : [createDefaultGuideWelcome()]
  );

  // Latest messages, readable synchronously. A message queued before login is sent in the same
  // commit in which the profile history arrives; reading `messages` from that render's closure
  // would see only the guest welcome card and overwrite the saved history on the server.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Sync when switching profiles / logging in or out
  useEffect(() => {
    const next =
      persistedMessages && persistedMessages.length > 0
        ? persistedMessages
        : [createDefaultGuideWelcome()];
    messagesRef.current = next;
    setMessages(next);
  }, [currentUser?.id, persistedMessages]);

  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedMimeType, setSelectedMimeType] = useState<string>('image/jpeg');
  const [imageFileName, setImageFileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedRequest, setLastFailedRequest] = useState<{
    text: string;
    image: string | null;
    mimeType: string;
  } | null>(null);
  const [currentActiveModel, setCurrentActiveModel] = useState<string>('Gemini 4 Hydrogen');
  const [queuedAuthSend, setQueuedAuthSend] = useState<{
    text: string;
    image: string | null;
    mimeType: string;
  } | null>(null);

  // Voice & Live Speech States
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoVoiceMode, setAutoVoiceMode] = useState(true);
  const [transcriptText, setTranscriptText] = useState('');
  const recognitionRef = useRef<any>(null);

  // Photo Choice Popover & Live Device Camera States
  const [isPhotoMenuOpen, setIsPhotoMenuOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const photoMenuRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraRequestIdRef = useRef(0);

  // Initialize Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'bg-BG';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscriptText(currentTranscript);
        setInput(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore stop errors on unmount
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
    };
  }, []);

  // Close photo choice popover on outside click or Escape
  useEffect(() => {
    if (!isPhotoMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (photoMenuRef.current && !photoMenuRef.current.contains(e.target as Node)) {
        setIsPhotoMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsPhotoMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isPhotoMenuOpen]);

  // Ensure video element gets attached stream once modal mounts
  useEffect(() => {
    if (isCameraOpen && cameraStreamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== cameraStreamRef.current) {
        videoRef.current.srcObject = cameraStreamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraOpen, isStartingCamera]);

  const toggleListening = () => {
    if (!currentUser && onRequireAuth) {
      onRequireAuth(
        'Влезте в профила си или се регистрирайте, за да използвате гласовия разговор с AI Пътеводителя.',
        () => {}
      );
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (!recognitionRef.current) {
        setErrorMessage(
          'Вашият браузър не поддържа гласово разпознаване (Web Speech API). Моля, използвайте Chrome, Edge или Safari.'
        );
        return;
      }
      setErrorMessage(null);
      setTranscriptText('');
      setInput('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Recognition start error:', err);
        setErrorMessage('Микрофонът не можа да бъде активиран. Проверете правата за достъп в браузъра.');
      }
    }
  };

  const speakReply = (text: string) => {
    if (!('speechSynthesis' in window) || !autoVoiceMode) return;

    window.speechSynthesis.cancel();

    const cleanText = text
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/[*_#`~]/g, '')
      .slice(0, 450);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'bg-BG';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const quickPrompts = [
    { label: 'Провери хотели и цени около Триград и Белинташ', icon: Hotel },
    { label: 'Каква е прогнозата за времето на Белинташ и връх Ботев днес?', icon: Globe },
    { label: 'Какви са цените за билети и престой около Крушунските водопади?', icon: Sun },
    { label: 'Препоръчай ми уикенд маршрут в Родопите', icon: Mountain },
    { label: 'Как се стига безопасно до скално светилище Белинташ?', icon: MapPin },
    { label: 'Кои пещери и окна в България са най-величествени?', icon: Compass },
    { label: 'Кои крепости са подходящи за семеен преход с деца?', icon: ShieldCheck },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, selectedImage]);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Моля, изберете валиден графичен файл (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setErrorMessage('Снимката е твърде голяма (макс. 8MB).');
      return;
    }

    setImageFileName(file.name);
    setSelectedMimeType(file.type || 'image/jpeg');

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSelectedImage(result);
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);

    // Reset input so re-selecting same file works
    e.target.value = '';
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImageFileName('');
  };

  const stopCameraStream = () => {
    // Invalidate any getUserMedia request still waiting on the permission prompt.
    cameraRequestIdRef.current += 1;
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const closeCameraModal = () => {
    stopCameraStream();
    setIsCameraOpen(false);
    setCameraError(null);
    setIsStartingCamera(false);
  };

  const startCameraStream = async (facing: 'environment' | 'user') => {
    stopCameraStream();
    const requestId = cameraRequestIdRef.current;
    setCameraError(null);
    setIsStartingCamera(true);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsStartingCamera(false);
      setCameraError(
        'Вашият браузър или вграденият изглед не поддържа директен достъп до камерата. Можете да използвате системната камера или да прикачите снимка.'
      );
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1600 }, height: { ideal: 1200 } },
          audio: false,
        });
      } catch {
        // Fallback to any available video camera
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      if (requestId !== cameraRequestIdRef.current) {
        // The camera modal was closed (or a newer request started) while waiting: release it.
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setCameraError(
          'Достъпът до камерата беше отказан. Моля, разрешете камерата в настройките на браузъра или използвайте бутона за файл.'
        );
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setCameraError('На това устройство не е открита активна камера.');
      } else {
        setCameraError('Камерата не можа да бъде стартирана. Опитайте отново или изберете снимка от устройството.');
      }
    } finally {
      setIsStartingCamera(false);
    }
  };

  const openDeviceCamera = async () => {
    setIsPhotoMenuOpen(false);
    setIsCameraOpen(true);
    await startCameraStream(cameraFacing);
  };

  const handleToggleCameraFacing = async () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    await startCameraStream(nextFacing);
  };

  const captureCameraFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
    setSelectedImage(dataUrl);
    setSelectedMimeType('image/jpeg');
    setImageFileName(`camera-${stamp}.jpg`);
    setErrorMessage(null);
    closeCameraModal();
  };

  const executeSendMessage = async (
    textToSend?: string,
    overrideImage?: string | null,
    overrideMime?: string
  ) => {
    const text = (textToSend !== undefined ? textToSend : input).trim();
    const activeImage = overrideImage !== undefined ? overrideImage : selectedImage;
    const activeMime = overrideMime || selectedMimeType;
    const hasImg = Boolean(activeImage);

    if ((!text && !hasImg) || isLoading) return;

    setErrorMessage(null);
    setLastFailedRequest(null);
    const userMsgText = text || (hasImg ? 'Моля, разпознай това място от снимката и ми разкажи за него.' : '');
    const userMsg: ChatMessage = {
      id: 'usr-' + Date.now(),
      sender: 'user',
      text: userMsgText,
      imageUrl: activeImage || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Strip any trailing unanswered user turn before appending the new attempt so history remains valid
    const base = messagesRef.current;
    const cleanedBase =
      base.length > 0 && base[base.length - 1].sender === 'user' ? base.slice(0, -1) : base;

    const nextWithUser = [...cleanedBase, userMsg];
    setMessages(nextWithUser);
    onPersistedMessagesChange?.(nextWithUser);

    const sentImage = activeImage;
    const sentMime = activeMime;

    // Clear input & preview immediately
    if (textToSend === undefined) setInput('');
    setSelectedImage(null);
    setImageFileName('');
    setIsLoading(true);

    try {
      // Build conversation history for API (exclude static welcome cards)
      const history = cleanedBase
        .filter((m) => m.id !== 'welcome' && m.id !== 'welcome-reset')
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          text: m.text,
        }));

      const response = await sendGuideMessage(userMsgText, history, sentImage || undefined, sentMime);

      if (response.modelUsed) {
        setCurrentActiveModel(response.modelUsed);
      }

      const cleanReply = stripMarkdownSymbols(response.reply);

      const guideMsg: ChatMessage = {
        id: 'guide-' + Date.now(),
        sender: 'guide',
        text: cleanReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: response.modelUsed,
        fallbackReason: response.fallbackReason,
        suggestedPlaceIds: response.suggestedPlaceIds,
        webSources: response.webSources,
        searchQueries: response.searchQueries,
      };

      const nextWithGuide = [...nextWithUser, guideMsg];
      setMessages(nextWithGuide);
      onPersistedMessagesChange?.(nextWithGuide);
      speakReply(cleanReply);
    } catch (err: any) {
      console.error(err);
      setLastFailedRequest({ text: userMsgText, image: sentImage, mimeType: sentMime });
      setErrorMessage(err.message || 'Възникна временна грешка при връзката с Пътеводителя.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && queuedAuthSend) {
      const pending = queuedAuthSend;
      setQueuedAuthSend(null);
      void executeSendMessage(pending.text, pending.image, pending.mimeType);
    }
  }, [currentUser, queuedAuthSend]);

  const handleSendMessage = async (
    textToSend?: string,
    overrideImage?: string | null,
    overrideMime?: string
  ) => {
    const text = (textToSend !== undefined ? textToSend : input).trim();
    const activeImage = overrideImage !== undefined ? overrideImage : selectedImage;
    const activeMime = overrideMime || selectedMimeType;
    const hasImg = Boolean(activeImage);

    if ((!text && !hasImg) || isLoading) return;

    if (!currentUser && onRequireAuth) {
      const pendingPayload = { text, image: activeImage || null, mimeType: activeMime };
      onRequireAuth(
        'Влезте в профила си или създайте регистрация, за да задавате въпроси на AI Пътеводителя и да получавате реални проверки на цени, хотели и прогнози.',
        () => {
          setQueuedAuthSend(pendingPayload);
        }
      );
      return;
    }

    await executeSendMessage(textToSend, overrideImage, overrideMime);
  };

  const handleRetryFailedMessage = () => {
    if (!lastFailedRequest || isLoading) return;
    const { text, image, mimeType } = lastFailedRequest;
    handleSendMessage(text, image, mimeType);
  };

  const handleResetChat = () => {
    const resetMessages: ChatMessage[] = [
      {
        id: 'welcome-reset',
        sender: 'guide',
        text: 'Започваме нов разговор! Можете да попитате за маршрут, забележителност или да качите снимка за визуално разпознаване от камерата.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: currentActiveModel,
        suggestedPlaceIds: ['chudnite-mostove', 'sedemte-rilski-ezera'],
      },
    ];
    setMessages(resetMessages);
    onPersistedMessagesChange?.(resetMessages);
    setSelectedImage(null);
    setImageFileName('');
    setErrorMessage(null);
    setLastFailedRequest(null);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Hidden file & camera inputs */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleImageFileChange}
      />

      {/* Editorial Header with Apple Liquid Glass Status Capsule */}
      <div className="border-b border-stone-200/80 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Editorial Live Guide Capsule */}
            <div className="liquid-glass-focus-pill liquid-iridescent-rim px-3 py-1 rounded-full flex items-center gap-2 text-stone-800 shadow-2xs font-bold text-[11px]">
              <Compass className="w-3.5 h-3.5 text-emerald-700" />
              <span>Теренен пътеводител</span>
              <span className="text-stone-400">·</span>
              <span className="text-emerald-700">Търсене, прогноза и снимки</span>
            </div>

            {/* TTS Audio Toggle */}
            <button
              onClick={() => {
                if (isSpeaking) stopSpeaking();
                setAutoVoiceMode(!autoVoiceMode);
              }}
              className={`px-3.5 py-2 sm:px-3 sm:py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                autoVoiceMode
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-stone-100 text-stone-600 border border-stone-200'
              }`}
              title={autoVoiceMode ? 'Гласовите отговори са активни' : 'Включи изговаряне на отговорите'}
            >
              {autoVoiceMode ? <Volume2 className="w-3.5 h-3.5 text-amber-800" /> : <VolumeX className="w-3.5 h-3.5 text-stone-500" />}
              <span>{autoVoiceMode ? 'Гласов отговор: Вкл' : 'Глас: Изкл'}</span>
            </button>

            <span className="text-[10px] text-stone-500 font-mono hidden md:inline">
              Актуални хотели, цени, прогноза за времето и разпознаване по снимка
            </span>
          </div>

          <h2 className="font-editorial text-3xl sm:text-4xl font-bold text-stone-950">
            Пътеводителят на България
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 max-w-2xl leading-relaxed">
            Теренен съветник с живо търсене в Google: проверявайте цени на хотели и входни билети, актуална прогноза за времето или разпознавайте обекти от снимка.
          </p>
        </div>

        {/* Action Button: Reset Chat (Apple Liquid Glass Focus Pill) */}
        <button
          onClick={handleResetChat}
          className="liquid-glass-focus-pill pl-2 pr-3.5 py-1.5 text-xs text-stone-800 hover:text-stone-950 rounded-full transition-all flex items-center gap-2 shadow-xs shrink-0 self-start sm:self-auto cursor-pointer group"
          title="Започни нов разговор"
        >
          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-white/80 border border-white/90 shadow-inner group-hover:rotate-180 transition-transform duration-500">
            <RotateCcw className="w-3.5 h-3.5 text-stone-600" />
          </div>
          <span className="font-bold">Нов разговор</span>
        </button>
      </div>

      {/* Main Chat Console Card - Liquid Water Card */}
      <div className="liquid-water-card rounded-3xl border border-white/80 shadow-xl flex flex-col h-[calc(100dvh-150px)] sm:h-[calc(100dvh-220px)] min-h-[520px] sm:min-h-[480px] max-h-[720px] overflow-hidden">
        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 min-w-0 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'guide' && (
                <div className="liquid-orb-btn-emerald w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-md mt-0.5 text-white">
                  <Compass className="w-5 h-5 text-emerald-100" />
                </div>
              )}

              <div
                className={`min-w-0 max-w-[88%] sm:max-w-[80%] overflow-hidden rounded-3xl p-4 sm:p-5 space-y-3.5 leading-relaxed text-sm ${
                  msg.sender === 'user'
                    ? 'liquid-glass-focus-pill-dark text-white rounded-tr-none shadow-md'
                    : 'liquid-water-card text-stone-900 rounded-tl-none border border-white/90 shadow-xs'
                }`}
              >
                {/* User Uploaded Photo Thumbnail in Bubble */}
                {msg.imageUrl && (
                  <div className="rounded-2xl overflow-hidden border border-white/30 shadow-md max-w-sm mb-2">
                    <img
                      src={msg.imageUrl}
                      alt="Качен кадър за анализ"
                      className="w-full h-auto max-h-56 object-cover"
                    />
                    <div className="bg-black/60 backdrop-blur-md px-3 py-1 text-[10px] text-stone-200 flex items-center gap-1.5 font-mono">
                      <Camera className="w-3 h-3 text-amber-300" />
                      <span>Кадър за разпознаване с Vision</span>
                    </div>
                  </div>
                )}

                {/* Message Text Body */}
                <div className="min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-sans text-sm sm:text-[15px] leading-relaxed">
                  {renderMessageWithClickableLinks(msg.text, msg.sender === 'user')}
                </div>

                {/* Fallback Notice Badge if a fallback model was automatically picked */}
                {msg.fallbackReason && (
                  <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-900 text-xs flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-700 shrink-0" />
                    <span className="font-semibold text-[11px] leading-snug">
                      {msg.fallbackReason}
                    </span>
                  </div>
                )}

                {/* Suggested Place Rich Cards / Links */}
                {msg.suggestedPlaceIds && msg.suggestedPlaceIds.length > 0 && (
                  <div className="pt-3 border-t border-stone-200/50 space-y-2.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-amber-800" />
                      <span>Препоръчани обекти от архива:</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {msg.suggestedPlaceIds.map((pid) => {
                        const matchedPlace = places.find((p) => p.id === pid || p.slug === pid);
                        if (!matchedPlace) return null;
                        return (
                          <div
                            key={pid}
                            onClick={() => onSelectPlaceById(pid)}
                            className="flex items-center gap-3 p-2 liquid-glass-focus-pill rounded-2xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] group"
                          >
                            <img
                              src={matchedPlace.imageUrl}
                              alt={matchedPlace.name}
                              className="w-13 h-13 rounded-xl object-cover bg-stone-900 shrink-0 shadow-xs"
                              referrerPolicy="no-referrer"
                              onError={(e) => handleImageError(e, matchedPlace.categoryId, matchedPlace.name)}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-editorial font-bold text-sm text-stone-950 group-hover:text-amber-900 truncate">
                                {matchedPlace.name}
                              </div>
                              <div className="text-[11px] text-stone-500 truncate">
                                {matchedPlace.regionName.split('(')[0].trim()} · {matchedPlace.difficulty}
                              </div>
                              <div className="text-[10px] text-amber-800 font-bold flex items-center gap-0.5 pt-0.5">
                                <span>Разгледай</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Grounding Web Sources & Live Search Queries */}
                {((msg.webSources && msg.webSources.length > 0) || (msg.searchQueries && msg.searchQueries.length > 0)) && (
                  <div className="pt-3 border-t border-stone-200/50 space-y-2 min-w-0 max-w-full">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Актуални уеб източници (Google Search в реално време):</span>
                    </div>
                    {msg.webSources && msg.webSources.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 min-w-0 max-w-full">
                        {msg.webSources.map((source, idx) => {
                          const safeHref = sanitizeExternalUrl(source.uri);
                          if (!safeHref) return null;
                          return (
                            <a
                              key={idx}
                              href={safeHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1 text-xs text-stone-800 liquid-glass-focus-pill rounded-full transition-colors hover:text-stone-950 max-w-full min-w-0"
                            >
                              <ExternalLink className="w-3 h-3 text-stone-500 shrink-0" />
                              <span className="truncate max-w-[200px]">{source.title || safeHref}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}

                    {msg.searchQueries && msg.searchQueries.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-500 pt-0.5">
                        <span className="font-bold text-[10px] text-stone-500 uppercase">Извършени търсения:</span>
                        {msg.searchQueries.map((query, qIdx) => (
                          <span
                            key={qIdx}
                            className="bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-2 py-0.5 rounded-full text-[10px] font-medium"
                          >
                            🔍 {query}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Attribution & timestamp */}
                <div className="flex items-center justify-between pt-1 text-[10px] text-stone-400 font-mono">
                  <span>{msg.sender === 'guide' ? 'Пътеводител · Скрито в България' : ''}</span>
                  <span>{msg.timestamp}</span>
                </div>
              </div>

              {msg.sender === 'user' && (
                <div className="liquid-orb-btn w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-md mt-0.5 text-stone-800">
                  <User className="w-4 h-4 text-stone-700" />
                </div>
              )}
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3 justify-start items-center">
              <div className="liquid-orb-btn w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-md animate-pulse">
                <Compass className="w-5 h-5 text-amber-800" />
              </div>
              <div className="liquid-glass-focus-pill px-4 py-3 rounded-2xl flex items-center gap-3 text-xs text-stone-800 shadow-xs">
                <Loader2 className="w-4 h-4 animate-spin text-amber-800" />
                <span>
                  {selectedImage
                    ? 'Пътеводителят разпознава снимката и съпоставя топографските данни...'
                    : 'Пътеводителят преглежда картите и търси проверена информация...'}
                </span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              {lastFailedRequest && (
                <button
                  type="button"
                  onClick={handleRetryFailedMessage}
                  disabled={isLoading}
                  className="px-3 py-1.5 rounded-full bg-white hover:bg-rose-100 border border-rose-300 text-rose-900 font-bold text-[11px] flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Опитай отново</span>
                </button>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Account Required Notice for Guests */}
        {!currentUser && onRequireAuth && (
          <div className="px-4 py-3 bg-amber-50/90 border-t border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start sm:items-center gap-2.5 text-amber-950">
              <Lock className="w-4 h-4 text-amber-800 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                За да разговаряте с AI Пътеводителя, да проверявате хотели и прогнози или да разпознавате снимки, влезте в профила си или създайте регистрация.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  onRequireAuth(
                    'Влезте в профила си, за да използвате AI Пътеводителя.',
                    () => {},
                    'login'
                  )
                }
                className="px-4 py-2.5 sm:px-3.5 sm:py-1.5 rounded-full bg-stone-900 hover:bg-stone-800 text-amber-200 font-bold text-[11px] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Вход</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onRequireAuth(
                    'Създайте регистрация, за да отключите AI Пътеводителя.',
                    () => {},
                    'register'
                  )
                }
                className="px-4 py-2.5 sm:px-3.5 sm:py-1.5 rounded-full bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold text-[11px] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Регистрация</span>
              </button>
            </div>
          </div>
        )}

        {/* Quick Suggestion Chips (Apple Liquid Glass Focus Pills) */}
        <div className="px-4 py-2 bg-stone-100/60 backdrop-blur-md border-t border-stone-200/60 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-stone-500 font-bold whitespace-nowrap text-[11px] uppercase tracking-wider">
            Теми:
          </span>
          {quickPrompts.map((q, idx) => {
            const Icon = q.icon;
            return (
              <button
                key={idx}
                onClick={() => handleSendMessage(q.label)}
                className="liquid-glass-focus-pill pl-2 pr-3 py-1 text-stone-800 hover:text-stone-950 rounded-full whitespace-nowrap transition-all text-xs font-bold inline-flex items-center gap-1.5 shrink-0 shadow-2xs hover:scale-105 active:scale-95 cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white/80 border border-white/90 shadow-inner text-amber-800 shrink-0">
                  <Icon className="w-3 h-3" />
                </div>
                <span>{q.label}</span>
              </button>
            );
          })}
        </div>

        {/* Attached Image Preview Strip (if photo selected) */}
        {selectedImage && (
          <div className="px-4 py-2.5 bg-amber-50/70 border-t border-amber-200/60 flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-amber-500/60 shrink-0 shadow-xs">
                <img src={selectedImage} alt="Избрана снимка" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-stone-900 truncate flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Снимка за анализ с Vision модел</span>
                </div>
                <div className="text-[11px] text-stone-500 truncate font-mono">
                  {imageFileName || 'Готова за разпознаване'}
                </div>
              </div>
            </div>

            <button
              onClick={removeSelectedImage}
              className="w-7 h-7 rounded-full flex items-center justify-center bg-stone-900/10 hover:bg-rose-600 hover:text-white text-stone-600 transition-colors shrink-0 cursor-pointer"
              title="Премахни снимката"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Chat Input Bar with Camera & Gallery Liquid Glass Orbs */}
        <div className="p-3 sm:p-4 bg-white/70 backdrop-blur-2xl border-t border-stone-200/70">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            {/* Camera Capture Orb Button (Take photo directly on mobile/tablet) */}
            {/* Live Microphone Speech Recognition Orb Button */}
            <button
              type="button"
              onClick={toggleListening}
              className={`liquid-orb-btn relative w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 cursor-pointer shadow-xs transition-all ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse border-2 border-rose-300 shadow-lg scale-110'
                  : 'text-stone-800 hover:text-stone-950'
              }`}
              title={isListening ? 'Спри гласовото слушане' : 'Започни разговор на живо (Гласов режим)'}
            >
              {isListening ? (
                <MicOff className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white" />
              ) : (
                <Mic className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-rose-700 group-hover:scale-110 transition-transform" />
              )}
            </button>

            {/* Stop Speaking / Audio Mute Orb Button */}
            {isSpeaking && (
              <button
                type="button"
                onClick={stopSpeaking}
                className="liquid-orb-btn w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center bg-amber-500 text-stone-950 shrink-0 cursor-pointer shadow-md animate-pulse"
                title="Спри изговарянето на гласа"
              >
                <VolumeX className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            )}

            {/* Unified Photo Button: Choose Take Photo (Device Camera) or Attach Photo */}
            <div className="relative shrink-0" ref={photoMenuRef}>
              <button
                type="button"
                onClick={() => {
                  if (!currentUser && onRequireAuth) {
                    onRequireAuth(
                      'Влезте в профила си или се регистрирайте, за да разпознавате забележителности по снимка.',
                      () => {}
                    );
                    return;
                  }
                  setIsPhotoMenuOpen((prev) => !prev);
                }}
                aria-expanded={isPhotoMenuOpen}
                aria-haspopup="menu"
                aria-label="Снимка: снимай с камера или прикачи"
                className={`liquid-orb-btn relative w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 cursor-pointer shadow-xs group transition-all ${
                  isPhotoMenuOpen
                    ? 'bg-emerald-900 text-amber-200 ring-2 ring-emerald-500/40'
                    : 'text-stone-800 hover:text-stone-950'
                }`}
                title="Снимай с камерата или прикачи снимка (Gemini Vision)"
              >
                <Camera className={`w-4 h-4 sm:w-4.5 sm:h-4.5 group-hover:scale-110 transition-transform ${isPhotoMenuOpen ? 'text-amber-300' : 'text-emerald-800'}`} />
              </button>

              {isPhotoMenuOpen && (
                <div
                  role="menu"
                  className="absolute bottom-full left-0 mb-2.5 w-60 rounded-2xl bg-[#FBF9F5]/98 backdrop-blur-2xl border border-stone-300/90 shadow-2xl p-1.5 z-40 space-y-1"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={openDeviceCamera}
                    className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-stone-900 hover:bg-emerald-900 hover:text-white transition-colors flex items-center gap-2.5 cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-full bg-emerald-100 group-hover:bg-emerald-800 flex items-center justify-center shrink-0">
                      <Camera className="w-3.5 h-3.5 text-emerald-800 group-hover:text-amber-300" />
                    </div>
                    <div>
                      <div>Снимай с камера</div>
                      <div className="text-[10px] font-normal opacity-75">Достъп до камерата на устройството</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsPhotoMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-stone-900 hover:bg-amber-100 transition-colors flex items-center gap-2.5 cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-3.5 h-3.5 text-amber-800" />
                    </div>
                    <div>
                      <div>Прикачи снимка</div>
                      <div className="text-[10px] font-normal text-stone-500">Избери файл от галерия / компютър</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Text Input - Liquid Glass Focus Capsule with Live Speech Waves */}
            <div className={`flex-1 liquid-glass-focus-pill liquid-iridescent-rim rounded-full px-3 sm:px-4 py-1.5 sm:py-2.5 flex items-center gap-2 focus-within:ring-2 focus-within:ring-amber-700/40 ${isListening ? 'border-2 border-rose-500 bg-rose-50/40' : ''}`}>
              {isListening && (
                <div className="flex items-center gap-1 text-rose-600 shrink-0 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                  <span>Слушам...</span>
                </div>
              )}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isListening
                    ? 'Говорете на български...'
                    : selectedImage
                    ? 'Попитайте за снимката...'
                    : 'Попитайте за хотели, цени, прогноза за времето или маршрут...'
                }
                className="w-full bg-transparent text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 font-semibold focus:outline-none"
                disabled={isLoading}
              />
            </div>

            {/* Send Button - Apple Liquid Emerald Glass Pill with Iridescent Rim */}
            <button
              type="submit"
              disabled={isLoading || (!input.trim() && !selectedImage)}
              className="btn-liquid-emerald water-shimmer liquid-iridescent-rim px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all shrink-0"
            >
              <Send className="w-4 h-4 text-emerald-100" />
              <span className="hidden sm:inline">Изпрати</span>
            </button>
          </form>
        </div>
      </div>

      {/* Emergency & Mountain Rescue Strip */}
      <div className="liquid-water-card rounded-2xl px-4 py-3 border border-rose-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2 font-semibold text-stone-800">
          <Phone className="w-4 h-4 text-rose-700 shrink-0" />
          <span>Спешни телефони в България (24/7):</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="tel:112"
            className="liquid-glass-focus-pill px-3 py-1 rounded-full font-bold text-rose-900 hover:text-rose-950 inline-flex items-center gap-1.5"
          >
            <span>Спешна помощ / Единен номер:</span>
            <span className="font-mono">112</span>
          </a>
          <a
            href="tel:1470"
            className="liquid-glass-focus-pill px-3 py-1 rounded-full font-bold text-amber-950 hover:text-stone-950 inline-flex items-center gap-1.5"
          >
            <span>Планинско спасяване (ПСС):</span>
            <span className="font-mono">1470</span>
          </a>
          <a
            href="tel:+35929632000"
            className="liquid-glass-focus-pill px-3 py-1 rounded-full font-semibold text-stone-800 hover:text-stone-950 font-mono"
          >
            +359 2 963 2000
          </a>
        </div>
      </div>

      {/* Hidden canvas for capturing frame from live camera video */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Live Device Camera Modal */}
      {isCameraOpen && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/85 backdrop-blur-md flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Камера на устройството"
        >
          <div className="w-full max-w-xl bg-stone-900 text-white rounded-3xl overflow-hidden border border-white/15 shadow-2xl">
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Заснемане с камерата</span>
              </div>
              <button
                type="button"
                onClick={closeCameraModal}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Затвори камерата"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraError ? 'hidden' : 'block'}`}
              />

              {isStartingCamera && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-stone-950/70 text-xs text-stone-200">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                  <span>Стартиране на камерата...</span>
                </div>
              )}

              {cameraError && (
                <div className="p-6 text-center space-y-4 max-w-md">
                  <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto" />
                  <p className="text-xs sm:text-sm text-stone-200 leading-relaxed">{cameraError}</p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        closeCameraModal();
                        cameraInputRef.current?.click();
                      }}
                      className="px-4 py-2 rounded-full bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Системна камера</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        closeCameraModal();
                        fileInputRef.current?.click();
                      }}
                      className="px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Прикачи файл</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!cameraError && (
              <div className="px-5 py-4 bg-stone-950/90 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleToggleCameraFacing}
                  disabled={isStartingCamera}
                  className="px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Смени камера</span>
                </button>

                <button
                  type="button"
                  onClick={captureCameraFrame}
                  disabled={isStartingCamera}
                  className="px-6 py-2.5 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 hover:brightness-110 text-stone-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-40 active:scale-95 transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>Снимай</span>
                </button>

                <button
                  type="button"
                  onClick={closeCameraModal}
                  className="px-3.5 py-2 rounded-full bg-white/10 hover:bg-rose-600/80 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Отказ
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
