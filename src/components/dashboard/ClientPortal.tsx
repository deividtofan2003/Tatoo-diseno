'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Calendar,
  Clock,
  Sparkles,
  Camera,
  Send,
  CheckCircle2,
  AlertTriangle,
  FileSignature,
  X,
  MessageSquare,
  Plus,
  Info,
  Flame,
  ShieldCheck,
  Compass,
  CornerDownRight,
  User,
  Users,
  Bot,
  ArrowRight,
  Repeat,
  Trash2,
  HelpCircle,
  RefreshCw,
  Search,
  MapPin,
  Building2
} from 'lucide-react';
import SignaturePad from 'signature_pad';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import PublicArtistAgenda from '@/components/dashboard/PublicArtistAgenda';
import { compressImageForChat } from '@/lib/image-upload';
import { ensureDarkInkSignature } from '@/lib/signature';
import ConsentDocumentModal from '@/components/dashboard/ConsentDocumentModal';
import StudioMapView from '@/components/dashboard/StudioMapView';

export default function ClientPortal({ user, profile }: { user: any; profile: any }) {
  const [activeTab, setActiveTab] = useState<'appointments' | 'chat' | 'history'>('appointments');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [studios, setStudios] = useState<any[]>([]);
  
  // Dedicated 1:1 Chat per Artist state
  const [selectedChatArtist, setSelectedChatArtist] = useState<any>(null);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [loading, setLoading] = useState(true);

  // Booking Modal State
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedStudioId, setSelectedStudioId] = useState('');
  const [selectedArtistId, setSelectedArtistId] = useState('');
  const [bookingType, setBookingType] = useState('tattoo_session');
  const [bookingDurationHours, setBookingDurationHours] = useState<number>(2.5);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('11:00');
  const [bookingDescription, setBookingDescription] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  // View / Print Legal Consent Document Modal State
  const [viewConsentModalApp, setViewConsentModalApp] = useState<any>(null);

  // Consent Modal State
  const [selectedConsentApp, setSelectedConsentApp] = useState<any>(null);
  const [dniNie, setDniNie] = useState('');
  const [allergiesAns, setAllergiesAns] = useState('no');
  const [medicationAns, setMedicationAns] = useState('no');
  const [signingConsent, setSigningConsent] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);

  // Reschedule Modal State
  const [rescheduleModalApp, setRescheduleModalApp] = useState<any>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('11:00');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  // Cancel Modal State
  const [cancelModalApp, setCancelModalApp] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('Imprevisto laboral o personal');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  // Quick date helpers for reschedule
  const formatLocalIso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const applyQuickRescheduleDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setRescheduleDate(formatLocalIso(d));
  };

  const applyNextDayOfWeek = (dayIdx: number) => {
    const d = new Date();
    let diff = dayIdx - d.getDay();
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff);
    setRescheduleDate(formatLocalIso(d));
  };

  // Scalable Multi-Studio & Multi-Artist Hierarchy
  const [selectedStudioForBrowsing, setSelectedStudioForBrowsing] = useState<any>(null);
  const [studioSearchTerm, setStudioSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [studioViewMode, setStudioViewMode] = useState<'grid' | 'map'>('grid');
  const [artistSearchTerm, setArtistSearchTerm] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');

  const handleUpdateStudioAddress = async (studioId: string, address: string, city: string) => {
    try {
      const res = await fetch('/api/studios/update-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioId, address, city })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al actualizar ubicación');
      setStudios(prev => prev.map(s => s.id === studioId ? { ...s, address, city } : s));
    } catch (err: any) {
      console.error('Update studio address error:', err);
      throw err;
    }
  };

  // Public Artist Agenda state (Privacy-protected calendar)
  const [agendaArtist, setAgendaArtist] = useState<any>(null);

  // Clear Chat Modal State
  const [showClearChatModal, setShowClearChatModal] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [clientIdState, setClientIdState] = useState<string | null>(null);

  const handleClearChat = async () => {
    if (!activeChat?.id) return;
    setClearingChat(true);
    try {
      const res = await fetch('/api/chat/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: activeChat.id })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al limpiar el chat');

      if (data.initialMessage) {
        setMessages([data.initialMessage]);
      } else {
        setMessages([]);
      }
      setShowClearChatModal(false);
    } catch (err: any) {
      alert(`Error al limpiar el chat: ${err.message}`);
    } finally {
      setClearingChat(false);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiThinking]);

  // Initialize signature pad when modal opens
  useEffect(() => {
    if (selectedConsentApp && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.parentElement?.clientWidth || 450;
      canvas.height = 180;
      signaturePadRef.current = new SignaturePad(canvas, {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        penColor: '#ffffff'
      });
    }
  }, [selectedConsentApp]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Get client ID from clients table if available
      const { data: clientRec } = await supabase
        .from('clients')
        .select('id, dni_nie')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (clientRec?.dni_nie) setDniNie(clientRec.dni_nie);
      const clientId = clientRec?.id;
      if (clientId) setClientIdState(clientId);

      // 2. Fetch appointments
      if (clientId) {
        const { data: apps } = await supabase
          .from('appointments')
          .select(`
            *,
            studios (id, name, address),
            artists (id, display_name),
            consent_forms (*)
          `)
          .eq('client_id', clientId)
          .order('start_time', { ascending: true });

        setAppointments(apps || []);
      }

      // 3. Fetch studios & artists (scalable metadata)
      const { data: stds } = await supabase
        .from('studios')
        .select('id, name, address, city, phone, bio, logo_url, opening_hours');
      const { data: arts } = await supabase
        .from('artists')
        .select('id, display_name, studio_id, specialties, hourly_rate, minimum_fee, bio');
      setStudios(stds || []);
      setArtists(arts || []);

      const defaultStudio = stds?.[0]?.id || '';
      const defaultArtist = arts?.[0]?.id || '';
      if (defaultStudio) setSelectedStudioId(defaultStudio);
      if (defaultArtist) setSelectedArtistId(defaultArtist);

    } catch (err) {
      console.error('Error loading client portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Open dedicated 1:1 chat with a specific artist
  const handleSelectChatArtist = async (art: any) => {
    setSelectedChatArtist(art);
    setLoadingChat(true);
    try {
      const sessionRes = await fetch('/api/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientProfileId: user.id,
          artistId: art.id,
          studioId: art.studio_id || studios[0]?.id
        })
      });

      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        if (sessionData.chat) setActiveChat(sessionData.chat);
        setMessages(sessionData.messages || []);
      }
    } catch (err) {
      console.error('Error opening chat with artist:', err);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, uploadedImgUrl?: string, promptOverride?: string) => {
    if (e) e.preventDefault();
    if (!selectedChatArtist) return;

    const textToSend = (promptOverride || inputText).trim();
    if ((!textToSend && !uploadedImgUrl) || sendingMsg) return;

    setInputText('');
    setSendingMsg(true);
    setIsAiThinking(true);

    // Optimistic UI push
    const tempId = 'temp-' + Date.now();
    const optimisticMsg = {
      id: tempId,
      sender_role: 'client',
      content: textToSend || (uploadedImgUrl ? 'Foto adjunta' : ''),
      image_url: uploadedImgUrl,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: activeChat?.id && !activeChat.id.startsWith('client-chat') ? activeChat.id : undefined,
          content: textToSend,
          imageUrl: uploadedImgUrl,
          senderRole: 'client',
          lang: profile?.language || 'es',
          clientProfileId: user?.id,
          artistId: selectedChatArtist.id,
          studioId: selectedChatArtist.studio_id || studios[0]?.id
        })
      });

      const data = await res.json();
      if (data.chat) {
        setActiveChat(data.chat);
      }

      // If AI executed book_appointment, append the created appointment immediately!
      if (data.createdAppointment) {
        setAppointments(prev => {
          const exists = prev.some(a => a.id === data.createdAppointment.id);
          if (exists) return prev.map(a => a.id === data.createdAppointment.id ? data.createdAppointment : a);
          return [...prev, data.createdAppointment];
        });
      }

      // If AI executed reschedule_appointment, update in local appointments state immediately!
      if (data.rescheduledAppointment) {
        setAppointments(prev => prev.map(a => a.id === data.rescheduledAppointment.id ? data.rescheduledAppointment : a));
      }

      // If AI cancelled appointment, update in local appointments state immediately!
      if (data.cancelledAppointmentId) {
        setAppointments(prev => prev.map(a => a.id === data.cancelledAppointmentId ? { ...a, status: 'cancelled' } : a));
      }

      if (data.aiResponse) {
        setMessages(prev => [
          ...prev.filter(m => m.id !== tempId),
          data.message || optimisticMsg,
          {
            ...data.aiResponse,
            createdAppointment: data.createdAppointment,
            rescheduledAppointment: data.rescheduledAppointment,
            cancelled_appointment_id: data.cancelledAppointmentId || data.aiResponse.cancelled_appointment_id,
            available_slots: data.availableSlots || data.aiResponse.available_slots,
            quote_data: data.quote || data.aiResponse.quote_data
          }
        ]);
      } else if (data.message) {
        setMessages(prev => [...prev.filter(m => m.id !== tempId), data.message]);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSendingMsg(false);
      setIsAiThinking(false);
    }
  };

  // Handle Photo upload with client-side compression to prevent HTTP 413 / Next.js payload errors
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Compresses 5-15MB phone camera photos down to ~100-200KB instantly via canvas
      const compressedDataUrl = await compressImageForChat(file, 1000, 0.75);
      handleSendMessage(undefined, compressedDataUrl);
    } catch (err: any) {
      console.error('Error compressing image:', err);
      const reader = new FileReader();
      reader.onload = () => {
        handleSendMessage(undefined, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle New Booking Creation using server-side API (bypasses RLS recursion)
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingSubmitting(true);

    try {
      const { data: clientRec } = await supabase
        .from('clients')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();

      let clientId = clientRec?.id;
      if (!clientId) {
        const { data: createdClient } = await supabase
          .from('clients')
          .insert({ profile_id: user.id })
          .select('id')
          .single();
        clientId = createdClient?.id;
      }

      const startDateTime = new Date(`${bookingDate}T${bookingTime}:00`);
      const durationHours = bookingType === 'design_consultation' ? 0.75 : bookingDurationHours;
      const endDateTime = new Date(startDateTime.getTime() + durationHours * 60 * 60 * 1000);

      const res = await fetch('/api/appointments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studioId: selectedStudioId,
          artistId: selectedArtistId,
          clientId,
          appointmentType: bookingType,
          title: bookingType === 'design_consultation' ? 'Consulta de Diseño' : 'Sesión de Tatuaje',
          description: bookingDescription,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          status: 'pending'
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Error al solicitar cita.');
      }

      setAppointments(prev => [...prev, data.appointment]);
      setIsBookingOpen(false);
      setBookingDescription('');
      alert('⚡ ¡Cita solicitada con éxito! El estudio confirmará el espacio en su agenda.');
    } catch (err: any) {
      alert(`Error al reservar cita: ${err.message}`);
    } finally {
      setBookingSubmitting(false);
    }
  };

  // Handle Signing Legal Consent
  const handleSignConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      return alert('Por favor, estampa tu firma en el recuadro antes de confirmar.');
    }

    setSigningConsent(true);
    const rawSignature = signaturePadRef.current.toDataURL();
    const signatureDataUrl = await ensureDarkInkSignature(rawSignature);

    try {
      const res = await fetch('/api/consent/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: selectedConsentApp.id,
          clientId: selectedConsentApp.client_id,
          artistId: selectedConsentApp.artist_id,
          fullName: profile?.full_name || user.email,
          dniNie: dniNie.trim(),
          signatureDataUrl,
          medicalDisclaimers: {
            hasAllergies: allergiesAns === 'yes',
            takesMedication: medicationAns === 'yes',
            isAdultConfirmed: true
          }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert('🛡️ ¡Consentimiento informado firmado y validado legalmente!');
      setSelectedConsentApp(null);
      loadData();
    } catch (err: any) {
      alert(`Error al firmar consentimiento: ${err.message}`);
    } finally {
      setSigningConsent(false);
    }
  };

  // Handle direct reschedule from UI modal
  const handleRescheduleAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleModalApp || !rescheduleDate || !rescheduleTime) return;

    setRescheduleSubmitting(true);
    try {
      const res = await fetch('/api/appointments/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: rescheduleModalApp.id,
          newDate: rescheduleDate,
          newTime: rescheduleTime,
          reason: rescheduleReason.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Error al reprogramar la cita.');
      }

      setAppointments(prev => prev.map(a => a.id === data.appointment.id ? data.appointment : a));
      setRescheduleModalApp(null);
      setRescheduleReason('');
      alert('🔄 ¡Cita reprogramada con éxito! El calendario del artista ya está actualizado.');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  // Handle direct appointment cancellation from UI modal
  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalApp) return;

    setCancelSubmitting(true);
    try {
      const res = await fetch('/api/appointments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: cancelModalApp.id,
          reason: cancelReason
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Error al cancelar la cita.');
      }

      setAppointments(prev =>
        prev.map(a =>
          a.id === cancelModalApp.id
            ? {
                ...a,
                status: 'cancelled',
                description: `${a.description || ''} (Cancelada: ${cancelReason})`
              }
            : a
        )
      );
      setCancelModalApp(null);
      alert('Tu cita ha sido cancelada correctamente y el hueco ha quedado liberado en la agenda.');
    } catch (err: any) {
      alert(`Error al cancelar: ${err.message}`);
    } finally {
      setCancelSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full">
      {/* Header with Tattoo Studio Atmosphere */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 bg-gradient-to-r from-ink-900/90 via-ink-950 to-ink-900/90 p-6 rounded-3xl border border-crimson-500/20 shadow-xl shadow-black/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-crimson-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] uppercase tracking-[0.3em] text-ink-400 font-medium flex items-center gap-3">
              Tu panel
              <span className="h-px w-10 bg-ink-600/60" />
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            Hola, {profile?.full_name || 'Coleccionista de Tinta'}
          </h1>
          <p className="text-xs text-ink-400 mt-1 max-w-xl">
            Aquí tienes tus citas, el chat con tu tatuador y el seguimiento de tu curación.
          </p>
        </div>

        <button
          onClick={() => setIsBookingOpen(true)}
          className="relative z-10 flex items-center gap-2 bg-crimson-600 hover:bg-crimson-700 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-md transition-colors border border-crimson-500/40"
        >
          <Plus className="w-4 h-4" />
          <span>Solicitar Cita de Tatuaje</span>
        </button>
      </div>

      {/* Navigation Tabs - Marked Tattoo Styling */}
      <div className="flex flex-wrap gap-2 sm:gap-3 border-b border-white/10 mb-8 pb-3">
        <button
          onClick={() => setActiveTab('appointments')}
          className={`flex items-center gap-2 px-4 sm:px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all ${
            activeTab === 'appointments'
              ? 'bg-gradient-to-r from-crimson-600 to-crimson-700 text-white border border-crimson-400/50 shadow-lg shadow-crimson-600/30'
              : 'text-ink-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Calendar className="w-4 h-4 text-white" />
          <span>Mis citas ({appointments.filter(a => a.status !== 'cancelled').length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 sm:px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all ${
            activeTab === 'history'
              ? 'bg-gradient-to-r from-ink-800 to-ink-900 text-white border border-white/30 shadow-lg'
              : 'text-ink-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Clock className="w-4 h-4 text-ink-300" />
          <span>Historial ({appointments.filter(a => a.status === 'cancelled').length})</span>
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-2 px-4 sm:px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all ${
            activeTab === 'chat'
              ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white border border-amber-400/50 shadow-lg shadow-amber-600/30'
              : 'text-ink-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-white" />
          <span>Chat con tu tatuador</span>
        </button>
      </div>

      {/* TAB 1: ACTIVE UPCOMING APPOINTMENTS */}
      {activeTab === 'appointments' && (
        <div className="space-y-6">
          {appointments.filter(a => a.status !== 'cancelled').length === 0 ? (
            <div className="glass-panel p-12 text-center rounded-3xl border border-white/10 bg-ink-950/60">
              <div className="w-16 h-16 rounded-2xl bg-crimson-500/10 border border-crimson-500/20 text-crimson-400 flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No tienes sesiones activas programadas</h3>
              <p className="text-sm text-ink-400 max-w-md mx-auto mb-6 leading-relaxed">
                Elige si prefieres una consulta gratuita de diseño (30-45 min) para definir tu pieza o una sesión completa de tatuaje en piel.
              </p>
              <button
                onClick={() => setIsBookingOpen(true)}
                className="inline-flex items-center gap-2 bg-crimson-600 hover:bg-crimson-500 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-crimson-600/30 transition-all hover:scale-105"
              >
                <Plus className="w-4 h-4" />
                <span>Pedir Primera Cita</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {appointments.filter(a => a.status !== 'cancelled').map((app) => {
                const startDate = new Date(app.start_time);
                const isSigned = app.consent_forms && app.consent_forms.length > 0;

                return (
                  <div key={app.id} className="glass-panel p-6 rounded-3xl border border-white/10 bg-ink-900/60 hover:border-amber-500/40 transition-colors flex flex-col justify-between group">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[11px] uppercase tracking-[0.25em] text-ink-400 font-medium flex items-center gap-3">
                          {app.appointment_type === 'design_consultation' ? 'Consulta de diseño' : 'Sesión de tatuaje'}
                          <span className="h-px w-8 bg-ink-600/60" />
                        </span>

                        <span className={`text-xs font-medium flex items-center gap-1.5 ${app.status === 'confirmed' ? 'text-crimson-300' : 'text-amber-300'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${app.status === 'confirmed' ? 'bg-crimson-500' : 'bg-amber-400'}`} />
                          {app.status === 'confirmed' ? 'Confirmada' : app.status === 'pending' ? 'Pendiente' : app.status}
                        </span>
                      </div>

                      <h3 className="font-display text-xl font-bold text-white mb-1.5">
                        {app.title || 'Cita con ' + app.artists?.display_name}
                      </h3>
                      <p className="text-xs text-ink-400 mb-4">
                        Con <strong className="text-ink-200">{app.artists?.display_name}</strong> en <strong className="text-ink-200">{app.studios?.name}</strong> · {app.studios?.address}
                      </p>

                      <div className="flex items-center gap-5 text-sm text-ink-100 mb-4 bg-ink-950/80 p-3.5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-amber-400" />
                          <span className="first-letter:uppercase">{startDate.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long' })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-400" />
                          <span>{startDate.toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>

                    {/* Legal Consent Signing Status & Appointment Actions */}
                    <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        {isSigned ? (
                          <div className="flex items-center gap-1.5">
                            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Consentimiento firmado
                            </span>
                            <button
                              type="button"
                              onClick={() => setViewConsentModalApp(app)}
                              className="text-[11px] font-semibold text-emerald-300 hover:text-white underline px-1 py-0.5 transition-colors"
                              title="Ver y descargar documento firmado oficial en PDF"
                            >
                              Descargar / PDF
                            </button>
                          </div>
                        ) : (
                          <span className="text-ink-400">
                            Falta firmar el consentimiento
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!isSigned && (
                          <button
                            onClick={() => setSelectedConsentApp(app)}
                            className="flex items-center gap-1.5 text-xs font-bold bg-crimson-600 hover:bg-crimson-700 text-white border border-crimson-500/40 px-3 py-1.5 rounded-xl transition-colors"
                          >
                            <FileSignature className="w-3.5 h-3.5" />
                            <span>Firmar</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const art = artists.find(a => a.id === app.artist_id);
                            if (art) {
                              setAgendaArtist(art);
                              setActiveTab('chat');
                            }
                          }}
                          className="flex items-center gap-1 text-xs font-semibold bg-white/5 hover:bg-white/10 text-ink-200 hover:text-white border border-white/10 px-2.5 py-1.5 rounded-xl transition-all"
                          title="Ver agenda pública del artista"
                        >
                          <span>Ver agenda</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRescheduleModalApp(app);
                            const curDate = app.start_time ? app.start_time.split('T')[0] : '';
                            const curTime = app.start_time ? new Date(app.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '11:00';
                            setRescheduleDate(curDate);
                            setRescheduleTime(curTime);
                          }}
                          className="flex items-center gap-1 text-xs font-semibold bg-white/5 hover:bg-white/10 text-ink-200 hover:text-white border border-white/10 px-2.5 py-1.5 rounded-xl transition-all"
                          title="Cambiar fecha u hora de la cita"
                        >
                          <span>Cambiar fecha</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCancelModalApp(app);
                            setCancelReason('Imprevisto laboral o personal');
                          }}
                          className="flex items-center gap-1 text-xs font-semibold text-ink-400 hover:text-red-300 px-2 py-1.5 transition-colors"
                          title="Cancelar esta cita"
                        >
                          <span>Cancelar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 1.5: HISTORY & CANCELLED APPOINTMENTS */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {appointments.filter(a => a.status === 'cancelled').length === 0 ? (
            <div className="glass-panel p-12 text-center rounded-3xl border border-white/10 bg-ink-950/60">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 text-ink-400 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No tienes citas canceladas</h3>
              <p className="text-sm text-ink-400 max-w-md mx-auto mb-6 leading-relaxed">
                Todas tus citas programadas se encuentran activas. Cuando canceles o concluyas una sesión, quedará archivada en este historial.
              </p>
              <button
                onClick={() => setActiveTab('appointments')}
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all"
              >
                <span>Ver Citas Activas</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {appointments.filter(a => a.status === 'cancelled').map((app) => {
                const startDate = new Date(app.start_time);
                return (
                  <div key={app.id} className="glass-panel p-6 rounded-3xl border border-red-500/20 bg-ink-950/70 flex flex-col justify-between opacity-85">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border bg-white/5 text-ink-400 border-white/10">
                          {app.appointment_type === 'design_consultation' ? 'Consulta de diseño' : 'Sesión de tatuaje'}
                        </span>
                        <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/30">
                          Cancelada
                        </span>
                      </div>

                      <h3 className="font-display text-lg font-bold text-ink-300 line-through mb-1.5">
                        {app.title || 'Cita con ' + app.artists?.display_name}
                      </h3>
                      <p className="text-xs text-ink-400 mb-3">
                        Artista: <strong className="text-ink-300">{app.artists?.display_name}</strong> · Estudio: {app.studios?.name}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-ink-400 mb-4 bg-ink-950/90 p-3 rounded-xl border border-white/5 font-mono">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-ink-500" />
                          <span>{startDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-ink-500" />
                          <span>{startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      {app.description && (
                        <p className="text-[11px] text-ink-400 italic bg-white/5 p-2.5 rounded-xl border border-white/5 mb-4">
                          {app.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[11px] text-ink-500">Hueco liberado</span>
                      <button
                        onClick={() => {
                          setSelectedArtistId(app.artist_id || '');
                          setSelectedStudioId(app.studio_id || '');
                          setIsBookingOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-crimson-600/20 hover:bg-crimson-600 text-crimson-300 hover:text-white font-bold text-xs border border-crimson-500/30 transition-all flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Volver a Agendar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AI & ARTIST CHAT (1:1 EXCLUSIVO POR ARTISTA) */}
      {activeTab === 'chat' && (
        <div className="space-y-4">
          {/* SCREEN A: IF NO ARTIST SELECTED -> ARTIST SELECTION VIEW */}
          {/* VIEW 1: PUBLIC AGENDA (IF USER CLICKED "VER AGENDA") */}
          {agendaArtist ? (
            <PublicArtistAgenda
              artist={agendaArtist}
              studio={studios.find(s => s.id === agendaArtist.studio_id)}
              currentClientId={clientIdState}
              onClose={() => setAgendaArtist(null)}
              onOpenChat={(art) => {
                setAgendaArtist(null);
                handleSelectChatArtist(art);
              }}
              onBookSlot={(date, time) => {
                setBookingDate(date);
                setBookingTime(time);
                setSelectedArtistId(agendaArtist.id);
                if (agendaArtist.studio_id) setSelectedStudioId(agendaArtist.studio_id);
                setIsBookingOpen(true);
              }}
            />
          ) : !selectedChatArtist ? (
            /* VIEW 2: SCALABLE STUDIO FINDER & ARTIST DIRECTORY */
            <div className="space-y-6">
              {!selectedStudioForBrowsing ? (
                /* STEP 2A: STUDIO FINDER (SEARCHABLE & SCALABLE ACROSS STUDIOS & CITIES) */
                <div className="glass-panel p-6 sm:p-10 rounded-3xl border border-white/10 bg-ink-950/70 shadow-2xl">
                  <div className="max-w-3xl mx-auto text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-crimson-600 to-amber-500 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-crimson-600/30">
                      <Building2 className="w-7 h-7" />
                    </div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-2">
                      Encuentra tu Estudio de Tatuajes
                    </h2>
                    <p className="text-sm text-ink-400 max-w-xl mx-auto">
                      Selecciona un estudio para explorar sus artistas residentes, consultar sus calendarios públicos o iniciar un chat directo 1:1 asistido por IA.
                    </p>
                  </div>

                  {/* Search and City Filters */}
                  <div className="max-w-3xl mx-auto mb-8 space-y-3">
                    <div className="relative">
                      <Search className="w-4 h-4 text-ink-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={studioSearchTerm}
                        onChange={(e) => setStudioSearchTerm(e.target.value)}
                        placeholder="Buscar estudio por nombre, dirección o ciudad..."
                        className="w-full pl-11 pr-4 py-3 rounded-2xl bg-ink-900/90 border border-white/10 text-white placeholder-ink-500 text-sm focus:outline-none focus:border-crimson-500/50 shadow-inner"
                      />
                      {studioSearchTerm && (
                        <button
                          onClick={() => setStudioSearchTerm('')}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* City Chips */}
                    {(() => {
                      const cities = Array.from(new Set(studios.map(s => s.city).filter(Boolean))) as string[];
                      if (cities.length <= 1) return null;
                      return (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-ink-400 font-mono mr-1">Ciudad:</span>
                          <button
                            onClick={() => setCityFilter('all')}
                            className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${
                              cityFilter === 'all'
                                ? 'bg-crimson-600 text-white shadow-md'
                                : 'bg-white/5 hover:bg-white/10 text-ink-300 border border-white/10'
                            }`}
                          >
                            Todas ({studios.length})
                          </button>
                          {cities.map((city) => (
                            <button
                              key={city}
                              onClick={() => setCityFilter(city)}
                              className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${
                                cityFilter === city
                                  ? 'bg-crimson-600 text-white shadow-md'
                                  : 'bg-white/5 hover:bg-white/10 text-ink-300 border border-white/10'
                              }`}
                            >
                              {city}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Mode Switcher: Cards vs Interactive Map */}
                  <div className="max-w-3xl mx-auto flex items-center justify-between pt-1 mb-6 border-t border-white/5">
                    <div className="text-xs text-ink-400 font-mono">
                      {studios.length} {studios.length === 1 ? 'estudio disponible' : 'estudios disponibles'}
                    </div>
                    <div className="flex items-center p-1 bg-ink-900 rounded-xl border border-white/10 shadow-inner">
                      <button
                        type="button"
                        onClick={() => setStudioViewMode('grid')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          studioViewMode === 'grid'
                            ? 'bg-crimson-600 text-white shadow-md'
                            : 'text-ink-400 hover:text-white'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Tarjetas</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudioViewMode('map')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          studioViewMode === 'map'
                            ? 'bg-crimson-600 text-white shadow-md'
                            : 'text-ink-400 hover:text-white'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5 text-amber-400" />
                        <span>Mapa Interactivo</span>
                      </button>
                    </div>
                  </div>

                  {studioViewMode === 'map' ? (
                    <StudioMapView
                      studios={studios.map(s => ({
                        ...s,
                        artists_count: artists.filter(a => a.studio_id === s.id).length
                      }))}
                      onSelectStudio={(st) => {
                        const fullStudio = studios.find(s => s.id === st.id) || st;
                        setSelectedStudioForBrowsing(fullStudio);
                        setArtistSearchTerm('');
                        setSpecialtyFilter('all');
                      }}
                      onBookAtStudio={(st) => {
                        const fullStudio = studios.find(s => s.id === st.id) || st;
                        setSelectedStudioForBrowsing(fullStudio);
                        setArtistSearchTerm('');
                        setSpecialtyFilter('all');
                      }}
                      onUpdateStudioAddress={handleUpdateStudioAddress}
                    />
                  ) : (
                    /* Studios List Grid */
                    studios.length === 0 ? (
                    <div className="text-center py-12 text-ink-400 font-mono text-sm">
                      Cargando estudios disponibles...
                    </div>
                  ) : (() => {
                    const filtered = studios.filter((st) => {
                      const matchQuery = !studioSearchTerm ||
                        st.name?.toLowerCase().includes(studioSearchTerm.toLowerCase()) ||
                        st.city?.toLowerCase().includes(studioSearchTerm.toLowerCase()) ||
                        st.address?.toLowerCase().includes(studioSearchTerm.toLowerCase());
                      const matchCity = cityFilter === 'all' || st.city?.toLowerCase() === cityFilter.toLowerCase();
                      return matchQuery && matchCity;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
                          <p className="text-sm text-ink-400 mb-2">No se encontraron estudios con los filtros seleccionados.</p>
                          <button
                            onClick={() => { setStudioSearchTerm(''); setCityFilter('all'); }}
                            className="text-xs text-crimson-400 hover:text-crimson-300 font-semibold"
                          >
                            Limpiar filtros de búsqueda
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filtered.map((st) => {
                          const studioArtistCount = artists.filter(a => a.studio_id === st.id).length;
                          return (
                            <div
                              key={st.id}
                              onClick={() => {
                                setSelectedStudioForBrowsing(st);
                                setArtistSearchTerm('');
                                setSpecialtyFilter('all');
                              }}
                              className="tattoo-card p-6 rounded-3xl border border-white/10 hover:border-crimson-500/60 cursor-pointer transition-all hover:scale-[1.02] flex flex-col justify-between group shadow-xl bg-ink-900/40"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div className="w-12 h-12 rounded-2xl bg-ink-900 border border-crimson-500/30 text-crimson-400 font-bold text-lg flex items-center justify-center shadow-inner group-hover:border-crimson-500 group-hover:scale-105 transition-all">
                                    <Building2 className="w-6 h-6 text-crimson-400" />
                                  </div>
                                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-crimson-500/10 text-crimson-300 border border-crimson-500/20 font-semibold flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {studioArtistCount} {studioArtistCount === 1 ? 'tatuador' : 'tatuadores'}
                                  </span>
                                </div>

                                <h3 className="font-bold text-white text-lg group-hover:text-crimson-400 transition-colors mb-1">
                                  {st.name}
                                </h3>

                                <div className="flex items-center gap-1.5 text-xs text-ink-300 mb-2">
                                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span className="truncate">{st.city ? `${st.city} · ` : ''}{st.address || 'Estudio de Tatuaje'}</span>
                                </div>

                                {st.bio && (
                                  <p className="text-xs text-ink-400 line-clamp-2 mb-4 leading-relaxed">
                                    {st.bio}
                                  </p>
                                )}
                              </div>

                              <button
                                type="button"
                                className="w-full mt-4 py-2.5 rounded-xl bg-crimson-600/20 group-hover:bg-crimson-600 text-crimson-300 group-hover:text-white border border-crimson-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2"
                              >
                                <span>Ver Artistas y Agendas</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                  )}
                </div>
              ) : (
                /* STEP 2B: RESIDENT ARTISTS IN SELECTED STUDIO */
                <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 bg-ink-950/70 shadow-2xl">
                  {/* Studio Breadcrumb / Back button & Studio Info */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedStudioForBrowsing(null)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-ink-300 hover:text-white border border-white/10 transition-all flex items-center gap-1 text-xs font-semibold"
                      >
                        <Repeat className="w-3.5 h-3.5" />
                        <span>Ver otros estudios</span>
                      </button>
                      <div>
                        <h2 className="font-display text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                          <span>{selectedStudioForBrowsing.name}</span>
                          <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Estudio Seleccionado
                          </span>
                        </h2>
                        <p className="text-xs text-ink-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-amber-400" />
                          <span>{selectedStudioForBrowsing.address}</span>
                          {selectedStudioForBrowsing.city && <span>· {selectedStudioForBrowsing.city}</span>}
                          {selectedStudioForBrowsing.phone && <span>· Tel: {selectedStudioForBrowsing.phone}</span>}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Search and Specialty Filter Bar for Artists */}
                  <div className="mb-6 space-y-3">
                    <div className="relative">
                      <Search className="w-4 h-4 text-ink-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={artistSearchTerm}
                        onChange={(e) => setArtistSearchTerm(e.target.value)}
                        placeholder="Buscar tatuador por nombre, estilo o especialidad..."
                        className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-ink-900/90 border border-white/10 text-white placeholder-ink-500 text-xs sm:text-sm focus:outline-none focus:border-crimson-500/50 shadow-inner"
                      />
                      {artistSearchTerm && (
                        <button
                          onClick={() => setArtistSearchTerm('')}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Specialty chips */}
                    {(() => {
                      const studioArts = artists.filter(a => a.studio_id === selectedStudioForBrowsing.id);
                      const allSpecs = Array.from(
                        new Set(studioArts.flatMap(a => (Array.isArray(a.specialties) ? a.specialties : [])))
                      ) as string[];

                      if (allSpecs.length <= 1) return null;
                      return (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-ink-400 font-mono mr-1">Estilo:</span>
                          <button
                            onClick={() => setSpecialtyFilter('all')}
                            className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-all ${
                              specialtyFilter === 'all'
                                ? 'bg-crimson-600 text-white shadow'
                                : 'bg-white/5 hover:bg-white/10 text-ink-300 border border-white/10'
                            }`}
                          >
                            Todos
                          </button>
                          {allSpecs.map((spec) => (
                            <button
                              key={spec}
                              onClick={() => setSpecialtyFilter(spec)}
                              className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-all ${
                                specialtyFilter === spec
                                  ? 'bg-crimson-600 text-white shadow'
                                  : 'bg-white/5 hover:bg-white/10 text-ink-300 border border-white/10'
                              }`}
                            >
                              {spec}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Artists Grid */}
                  {(() => {
                    const studioArts = artists.filter(a => a.studio_id === selectedStudioForBrowsing.id);
                    const filteredArts = studioArts.filter((art) => {
                      const matchSearch = !artistSearchTerm ||
                        art.display_name?.toLowerCase().includes(artistSearchTerm.toLowerCase()) ||
                        art.bio?.toLowerCase().includes(artistSearchTerm.toLowerCase()) ||
                        (art.specialties && art.specialties.some((s: string) => s.toLowerCase().includes(artistSearchTerm.toLowerCase())));
                      const matchSpec = specialtyFilter === 'all' ||
                        (Array.isArray(art.specialties) && art.specialties.includes(specialtyFilter));
                      return matchSearch && matchSpec;
                    });

                    if (studioArts.length === 0) {
                      return (
                        <div className="text-center py-12 text-ink-400 font-mono text-sm">
                          Este estudio aún no tiene tatuadores asignados.
                        </div>
                      );
                    }

                    if (filteredArts.length === 0) {
                      return (
                        <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
                          <p className="text-sm text-ink-400 mb-2">No se encontraron artistas que coincidan con la búsqueda.</p>
                          <button
                            onClick={() => { setArtistSearchTerm(''); setSpecialtyFilter('all'); }}
                            className="text-xs text-crimson-400 hover:text-crimson-300 font-semibold"
                          >
                            Restablecer filtros
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredArts.map((art) => (
                          <div
                            key={art.id}
                            className="tattoo-card p-6 rounded-3xl border border-white/10 hover:border-crimson-500/60 transition-all flex flex-col justify-between group shadow-xl bg-ink-900/40"
                          >
                            <div>
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-ink-900 border border-crimson-500/30 text-crimson-400 font-bold text-lg flex items-center justify-center shadow-inner group-hover:border-crimson-500 group-hover:scale-105 transition-all">
                                  {art.display_name?.charAt(0) || 'A'}
                                </div>
                                <div>
                                  <h3 className="font-bold text-white text-base group-hover:text-crimson-400 transition-colors">
                                    {art.display_name}
                                  </h3>
                                  <span className="text-[11px] text-ink-400 font-mono">
                                    Tarifa base: {art.minimum_fee || 60}€ {art.hourly_rate ? `· ${art.hourly_rate}€/h` : ''}
                                  </span>
                                </div>
                              </div>

                              {/* Specialties badges */}
                              <div className="flex flex-wrap gap-1.5 mb-4">
                                {(art.specialties && art.specialties.length > 0 ? art.specialties : ['Tattoo', 'Custom Ink']).map((spec: string, sIdx: number) => (
                                  <span
                                    key={sIdx}
                                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 text-ink-300 border border-white/5"
                                  >
                                    {spec}
                                  </span>
                                ))}
                              </div>

                              {art.bio && (
                                <p className="text-xs text-ink-400 line-clamp-2 mb-4 leading-relaxed">
                                  {art.bio}
                                </p>
                              )}
                            </div>

                            {/* Triple Action: Chat 1:1, Ver Agenda, Pedir Cita */}
                            <div className="space-y-2 pt-3 border-t border-white/5">
                              <button
                                type="button"
                                onClick={() => handleSelectChatArtist(art)}
                                className="w-full py-2.5 rounded-xl bg-crimson-600/20 hover:bg-crimson-600 text-crimson-300 hover:text-white border border-crimson-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Chatear con Tatuador & IA</span>
                                <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                              </button>

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setAgendaArtist(art)}
                                  className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-ink-300 hover:text-white border border-white/10 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                                  title="Ver calendario público con privacidad"
                                >
                                  <Calendar className="w-3.5 h-3.5 text-crimson-400" />
                                  <span>Ver agenda</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedArtistId(art.id);
                                    setSelectedStudioId(selectedStudioForBrowsing.id);
                                    setIsBookingOpen(true);
                                  }}
                                  className="flex-1 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Pedir Cita</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : (
            /* VIEW 3: DEDICATED 1:1 CHAT WITH SELECTED ARTIST */
            <div className="chat-light rounded-3xl border border-white/10 overflow-hidden flex flex-col h-[740px] shadow-2xl relative">
              {/* Chat Header */}
              <div className="chat-head p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-ink-950 border border-amber-500/50 flex items-center justify-center text-amber-300 text-xl logo-t">
                    {selectedChatArtist.display_name?.charAt(0) || 'A'}
                  </div>
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-2 chat-title">
                      <span>{selectedChatArtist.display_name}</span>
                      {activeChat?.ai_enabled ? (
                        <span className="text-[11px] font-medium flex items-center gap-1.5 chat-status">
                          <span className="w-2 h-2 rounded-full bg-crimson-500" />
                          Responde al momento
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium flex items-center gap-1.5 chat-status">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          {selectedChatArtist.display_name} está conectado
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-ink-400">
                      {studios.find(s => s.id === selectedChatArtist.studio_id)?.name ? (
                        <span className="font-medium mr-1.5">
                          {studios.find(s => s.id === selectedChatArtist.studio_id)?.name} •
                        </span>
                      ) : null}
                      {selectedChatArtist.specialties?.join(' · ') || 'Todos los estilos'}
                    </p>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2">
                  {/* Public Agenda button */}
                  <button
                    onClick={() => setAgendaArtist(selectedChatArtist)}
                    className="flex items-center gap-1.5 bg-crimson-600/20 hover:bg-crimson-600/30 border border-crimson-500/40 text-crimson-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm"
                    title="Ver calendario con huecos libres y citas ocupadas anónimas"
                  >
                    <Calendar className="w-3.5 h-3.5 text-crimson-400" />
                    <span>Ver agenda</span>
                  </button>

                  {/* Clear Chat button */}
                  <button
                    onClick={() => setShowClearChatModal(true)}
                    className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 hover:text-red-200 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                    title="Eliminar todos los mensajes de este chat"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>Limpiar chat</span>
                  </button>

                  {/* Switch Artist Button */}
                  <button
                    onClick={() => setSelectedChatArtist(null)}
                    className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-ink-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Repeat className="w-3.5 h-3.5 text-crimson-500" />
                    <span>Cambiar tatuador</span>
                  </button>
                </div>
              </div>

              {/* Quick Action Prompt Chips */}
              <div className="chat-chips px-4 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => handleSendMessage(undefined, undefined, '¿Qué huecos y horarios tienes disponibles para una cita?')}
                  className="chat-chip text-xs whitespace-nowrap px-3.5 py-1.5 rounded-full transition-colors flex items-center gap-1 font-medium"
                >
                  <span>Ver huecos libres</span>
                </button>
                <button
                  onClick={() => handleSendMessage(undefined, undefined, 'Quiero cambiar la fecha u hora de mi cita agendada')}
                  className="chat-chip text-xs whitespace-nowrap px-3.5 py-1.5 rounded-full transition-colors flex items-center gap-1 font-medium"
                >
                  <span>Cambiar mi cita</span>
                </button>
                <button
                  onClick={() => handleSendMessage(undefined, undefined, 'Quiero cancelar mi cita próxima')}
                  className="chat-chip text-xs whitespace-nowrap px-3.5 py-1.5 rounded-full transition-colors flex items-center gap-1 font-medium"
                >
                  <span>Cancelar mi cita</span>
                </button>
                <button
                  onClick={() => handleSendMessage(undefined, undefined, '¿Qué citas tengo agendadas en mi cuenta?')}
                  className="chat-chip text-xs whitespace-nowrap px-3.5 py-1.5 rounded-full transition-colors flex items-center gap-1 font-medium"
                >
                  <span>Mis citas</span>
                </button>
                <button
                  onClick={() => handleSendMessage(undefined, undefined, '¿Cuánto costaría aproximadamente un tatuaje de 15 cm a color en el antebrazo?')}
                  className="chat-chip text-xs whitespace-nowrap px-3.5 py-1.5 rounded-full transition-colors flex items-center gap-1 font-medium"
                >
                  <span>Precio de un tatuaje</span>
                </button>
                <button
                  onClick={() => handleSendMessage(undefined, undefined, 'Quiero hablar con el tatuador')}
                  className="chat-chip text-xs whitespace-nowrap px-3.5 py-1.5 rounded-full transition-colors flex items-center gap-1 font-medium"
                >
                  <span>Hablar con {selectedChatArtist.display_name}</span>
                </button>
              </div>

              {/* Messages Area */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
                {/* Transparent Initial Welcome Banner (pinned) */}
                <div className="chat-welcome p-5 rounded-2xl text-sm space-y-3">
                  <div className="font-display text-lg font-bold">
                    <span>Hola, bienvenido al estudio de {selectedChatArtist.display_name}</span>
                  </div>
                  <p className="leading-relaxed">
                    Escríbenos lo que necesites y te contestamos al momento. Por aquí puedes:
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-ink-300 font-medium">
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span><strong>Pedir precio:</strong> dinos el tamaño y la zona (por ejemplo, 15 cm en el antebrazo).</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span><strong>Pedir o cambiar cita:</strong> te enseñamos los huecos libres.</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span><strong>Enseñar tu curación:</strong> mándanos una foto con el botón de la cámara.</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span><strong>Hablar con {selectedChatArtist.display_name}:</strong> pídelo y te atiende él en persona.</span>
                    </li>
                  </ul>
                  <div className="pt-3 text-xs flex items-center gap-1.5 chat-note">
                    <span>Te responde el asistente del estudio. {selectedChatArtist.display_name} lee todas las conversaciones y puede contestarte él cuando quiera.</span>
                  </div>
                </div>

                {loadingChat && (
                  <div className="text-center py-12 text-xs text-ink-500">
                    Cargando la conversación con {selectedChatArtist.display_name}...
                  </div>
                )}

                {messages.map((msg) => {
                  const isClient = msg.sender_role === 'client';
                  const isAi = msg.sender_role === 'ai_assistant';

                  return (
                    <div key={msg.id} className={`flex flex-col ${isClient ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[88%] sm:max-w-[78%] p-4 rounded-2xl text-sm leading-relaxed ${
                        isClient
                          ? 'bubble-me rounded-br-md'
                          : isAi
                          ? 'bubble-them rounded-bl-md'
                          : 'bubble-artist rounded-bl-md'
                      }`}>
                        {/* Role Label */}
                        <span className="block text-[11px] font-semibold mb-1 opacity-70">
                          {isClient ? 'Tú' : isAi ? `Estudio de ${selectedChatArtist.display_name}` : selectedChatArtist.display_name}
                        </span>

                        {/* Attached Image */}
                        {msg.image_url && (
                          <div className="mb-3 rounded-xl overflow-hidden border border-white/15 max-w-xs shadow-lg">
                            <img src={msg.image_url} alt="Foto tatuaje" className="w-full h-auto object-cover max-h-56" />
                          </div>
                        )}

                        {/* Content with full Markdown formatting */}
                        <MarkdownRenderer content={msg.content} />

                        {/* Interactive Available Slots Quick-Picker Chips */}
                        {msg.available_slots && msg.available_slots.length > 0 && (
                          <div className="mt-3 p-4 rounded-2xl chat-slots text-xs space-y-3 relative overflow-hidden">
                            
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold flex items-center gap-2">
                                <span>Huecos libres</span>
                              </div>
                              <span className="text-[11px] opacity-60">Toca uno para reservarlo</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {msg.available_slots.map((slot: any, sIdx: number) => (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={() => handleSendMessage(undefined, undefined, `Resérvame cita para el ${slot.date} a las ${slot.time} (${slot.label}) para ${slot.appointment_type === 'design_consultation' ? 'consulta de diseño' : 'sesión de tatuaje'}`)}
                                  className="tattoo-slot-btn px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs font-bold transition-all shadow-md group cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
                                    <span className="capitalize">{slot.label}</span>
                                  </div>
                                  <span className="text-[11px] px-2 py-0.5 rounded-md">
                                    Reservar →
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Interactive Confirmed Appointment Card (Created via AI) */}
                        {(msg.createdAppointment || msg.created_appointment) && (
                          <div className="mt-3 p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-xs space-y-1.5 shadow-lg">
                            <div className="font-bold text-emerald-400 flex items-center gap-1.5 text-sm">
                              <span>Cita guardada en el calendario</span>
                            </div>
                            <div className="text-ink-200">
                              <strong>Tipo:</strong> {(msg.createdAppointment || msg.created_appointment).appointment_type === 'design_consultation' ? 'Consulta de Diseño' : 'Sesión de Tatuaje'}
                            </div>
                            <div className="text-ink-200 font-mono text-[11px]">
                              <strong>Fecha y Hora:</strong> {new Date((msg.createdAppointment || msg.created_appointment).start_time).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long' })} a las {new Date((msg.createdAppointment || msg.created_appointment).start_time).toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' })}h
                            </div>
                            <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between">
                              <span className="text-[10px] text-emerald-400/80">Reflejada en tu pestaña Mis Citas</span>
                              <button
                                onClick={() => setActiveTab('appointments')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[10px] transition-colors"
                              >
                                Ver Mis Citas →
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Interactive Rescheduled Appointment Card (Updated via AI) */}
                        {(msg.rescheduledAppointment || msg.rescheduled_appointment) && (
                          <div className="mt-3 p-3.5 rounded-2xl bg-blue-950/40 border border-blue-500/40 text-xs space-y-1.5 shadow-lg">
                            <div className="font-bold text-blue-400 flex items-center gap-1.5 text-sm">
                              <span>🔄 Cita Reprogramada con Éxito</span>
                            </div>
                            <div className="text-ink-200 font-mono text-[11px]">
                              <strong>Nueva Fecha y Hora:</strong> {new Date((msg.rescheduledAppointment || msg.rescheduled_appointment).start_time).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long' })} a las {new Date((msg.rescheduledAppointment || msg.rescheduled_appointment).start_time).toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' })}h
                            </div>
                            <div className="pt-2 border-t border-blue-500/20 flex items-center justify-between">
                              <span className="text-[10px] text-blue-400/80">Calendario actualizado</span>
                              <button
                                onClick={() => setActiveTab('appointments')}
                                className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-bold text-[10px] transition-colors"
                              >
                                Ver Mis Citas →
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Interactive Cancelled Appointment Card (Cancelled via AI) */}
                        {(msg.cancelled_appointment_id || msg.cancelledAppointmentId) && (
                          <div className="mt-3 p-3.5 rounded-2xl bg-red-950/40 border border-red-500/40 text-xs space-y-1.5 shadow-lg">
                            <div className="font-bold text-red-400 flex items-center gap-1.5 text-sm">
                              <span>Cita cancelada</span>
                            </div>
                            <div className="text-ink-200">
                              Tu cita ha sido cancelada correctamente y el hueco ha quedado liberado en la agenda.
                            </div>
                            <div className="pt-2 border-t border-red-500/20 flex items-center justify-between">
                              <span className="text-[10px] text-red-400/80">Reflejada en Historial</span>
                              <button
                                onClick={() => handleSendMessage(undefined, undefined, '¿Qué huecos libres tienes disponibles para reservar una nueva cita?')}
                                className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-[10px] transition-colors"
                              >
                                Buscar nuevo hueco →
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Healing status badge */}
                        {msg.healing_status && (
                          <div className="mt-2.5 pt-2 border-t border-white/10 text-xs flex items-center gap-1.5 font-semibold">
                            {msg.healing_status === 'normal' && <span className="text-emerald-400 font-bold">✅ Cicatrización Fisiológica Normal</span>}
                            {msg.healing_status === 'redness_mild' && <span className="text-amber-400 font-bold">⚠️ Enrojecimiento Leve Esperable</span>}
                            {msg.healing_status === 'alert_infection' && <span className="text-crimson-400 font-bold">🚨 Alerta: Posible Irritación Severa o Supuración</span>}
                          </div>
                        )}

                        {/* Quote Card if calculation generated */}
                        {msg.quote_data && (
                          <div className="mt-3 p-3 rounded-xl bg-black/40 border border-amber-500/30 text-xs space-y-1">
                            <div className="font-bold text-amber-400 flex items-center gap-1">
                              <span>💰 {msg.quote_data.pricing_mode === 'session' ? `Precio por sesión: ${msg.quote_data.session_price}€` : `Estimación: ${msg.quote_data.estimated_min}€ - ${msg.quote_data.estimated_max}€`}</span>
                            </div>
                            <p className="text-[11px] text-ink-400">{msg.quote_data.disclaimer}</p>
                          </div>
                        )}
                      </div>

                      <span className="text-[10px] mt-1 px-1 chat-time">
                        {new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}

                {/* Live Typing Indicator */}
                {isAiThinking && (
                  <div className="flex flex-col items-start">
                    <div className="bubble-them p-3.5 rounded-2xl rounded-bl-md flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-crimson-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-crimson-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-crimson-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs chat-time">Escribiendo…</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <form onSubmit={(e) => handleSendMessage(e)} className="chat-input p-3.5 flex items-center gap-2">
                {/* Camera Button */}
                <label className="chat-cam p-3 rounded-full cursor-pointer transition-colors flex items-center justify-center shrink-0" title="Mandar una foto de tu tatuaje">
                  <Camera className="w-5 h-5" />
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Escribe un mensaje a ${selectedChatArtist.display_name}…`}
                  className="chat-field flex-1 px-5 py-3 rounded-full text-sm focus:outline-none transition-colors"
                />

                <button
                  type="submit"
                  disabled={sendingMsg || (!inputText.trim())}
                  className="p-3 rounded-full bg-crimson-600 hover:bg-crimson-700 disabled:opacity-40 text-white transition-colors shrink-0"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* BOOKING MODAL */}
      {isBookingOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="booking-modal glass-panel w-full max-w-lg p-6 sm:p-8 rounded-3xl border border-amber-500/25 bg-ink-950/95 relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsBookingOpen(false)}
              className="absolute top-5 right-5 text-ink-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-ink-400 font-medium mb-2">
              <span>Nueva cita</span>
              <span className="h-px w-10 bg-ink-600/60" />
            </div>
            <h2 className="font-display text-2xl font-bold text-white mb-1">Pide tu <span className="italic font-semibold text-crimson-300">cita</span></h2>
            <p className="text-sm text-ink-400 mb-6">Elige estudio, tatuador y qué quieres hacerte.</p>

            <form onSubmit={handleCreateBooking} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-ink-300 uppercase tracking-wider mb-1.5">Estudio</label>
                <select
                  value={selectedStudioId}
                  onChange={(e) => setSelectedStudioId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-ink-900 border border-white/10 text-white text-sm focus:outline-none focus:border-crimson-500"
                >
                  {studios.map(s => <option key={s.id} value={s.id}>{s.name} ({s.address})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-300 uppercase tracking-wider mb-1.5">Tatuador</label>
                <select
                  value={selectedArtistId}
                  onChange={(e) => setSelectedArtistId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-ink-900 border border-white/10 text-white text-sm focus:outline-none focus:border-crimson-500"
                >
                  {artists.map(a => <option key={a.id} value={a.id}>{a.display_name} ({a.specialties?.join(', ') || 'Todo estilo'})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBookingType('design_consultation')}
                  className={`p-3.5 rounded-2xl border text-xs font-bold text-left transition-all ${
                    bookingType === 'design_consultation'
                      ? 'bg-amber-500/10 text-ink-50 border-amber-500/50'
                      : 'bg-ink-900 text-ink-400 border-white/5'
                  }`}
                >
                  <span className="block font-bold mb-0.5">Consulta de diseño</span>
                  <span className="text-[11px] font-normal text-ink-400">30–45 min para preparar el boceto</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBookingType('tattoo_session')}
                  className={`p-3.5 rounded-2xl border text-xs font-bold text-left transition-all ${
                    bookingType === 'tattoo_session'
                      ? 'bg-amber-500/10 text-ink-50 border-amber-500/50'
                      : 'bg-ink-900 text-ink-400 border-white/5'
                  }`}
                >
                  <span className="block font-bold mb-0.5">Sesión de tatuaje</span>
                  <span className="text-[11px] font-normal text-ink-400">El día que te tatúas</span>
                </button>
              </div>

              {bookingType === 'tattoo_session' && (
                <div className="bg-ink-900/60 p-3.5 rounded-2xl border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-ink-300">
                    <span className="font-semibold uppercase tracking-wider text-[11px]">Tamaño y duración</span>
                    <span className="text-amber-300 font-semibold">{bookingDurationHours} h de sesión</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {[
                      { hours: 1, label: 'Flash / Mini', time: '1h' },
                      { hours: 1.5, label: 'Pequeño / Frase', time: '1.5h' },
                      { hours: 2.5, label: 'Mediano / Detalle', time: '2.5h' },
                      { hours: 4, label: 'Grande / Media Manga', time: '4h' },
                      { hours: 5, label: 'Manga / Espalda', time: '5h' }
                    ].map((opt) => (
                      <button
                        key={opt.hours}
                        type="button"
                        onClick={() => setBookingDurationHours(opt.hours)}
                        className={`p-2 rounded-xl text-left border transition-all text-xs ${
                          bookingDurationHours === opt.hours
                            ? 'bg-amber-500/10 border-amber-500/50 text-white font-bold'
                            : 'bg-ink-950/60 border-white/5 text-ink-400 hover:text-white'
                        }`}
                      >
                        <div className="truncate font-semibold">{opt.label}</div>
                        <div className="text-[11px] text-ink-400">{opt.time}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-300 uppercase tracking-wider mb-1.5">Fecha</label>
                  <input
                    type="date"
                    required
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-ink-900 border border-white/10 text-white text-sm focus:outline-none focus:border-crimson-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-300 uppercase tracking-wider mb-1.5">Hora</label>
                  <input
                    type="time"
                    required
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-ink-900 border border-white/10 text-white text-sm focus:outline-none focus:border-crimson-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-300 uppercase tracking-wider mb-1.5">Qué te quieres hacer y dónde</label>
                <textarea
                  rows={2}
                  value={bookingDescription}
                  onChange={(e) => setBookingDescription(e.target.value)}
                  placeholder="Ej.: una daga con serpiente en el antebrazo derecho"
                  className="w-full px-4 py-2 rounded-xl bg-ink-900 border border-white/10 text-white text-sm focus:outline-none focus:border-crimson-500"
                />
              </div>

              <button
                type="submit"
                disabled={bookingSubmitting}
                className="w-full py-3.5 rounded-xl bg-crimson-600 hover:bg-crimson-700 text-white font-bold text-sm shadow-md transition-colors"
              >
                {bookingSubmitting ? 'Confirmando…' : 'Confirmar cita'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CONSENT SIGNING MODAL WITH SIGNATURE PAD */}
      {selectedConsentApp && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 sm:p-8 rounded-3xl border border-amber-500/30 bg-ink-950/95 relative max-h-[90vh] overflow-y-auto shadow-2xl">
            <button
              onClick={() => setSelectedConsentApp(null)}
              className="absolute top-5 right-5 text-ink-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-ink-400 font-medium mb-2">
              <span>Antes de tu cita</span>
              <span className="h-px w-10 bg-ink-600/60" />
            </div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">Consentimiento Informado</h2>
            <p className="text-xs text-ink-400 mb-6">
              Para la cita del {new Date(selectedConsentApp.start_time).toLocaleDateString('es-ES')} con {selectedConsentApp.artists?.display_name}.
            </p>

            <form onSubmit={handleSignConsent} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-ink-300 uppercase tracking-wider mb-1">
                  DNI / NIE / Pasaporte *
                </label>
                <input
                  type="text"
                  required
                  value={dniNie}
                  onChange={(e) => setDniNie(e.target.value)}
                  placeholder="12345678X"
                  className="w-full px-4 py-2.5 rounded-xl bg-ink-900 border border-white/10 text-white uppercase text-sm focus:outline-none focus:border-crimson-500"
                />
              </div>

              <div className="bg-ink-900/80 p-4 rounded-2xl border border-white/5 space-y-3 text-ink-300">
                <div>
                  <span className="font-semibold block text-white mb-1">¿Padeces alguna alergia conocida (látex, tintas, metales, antisépticos)?</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="allergies" value="no" checked={allergiesAns === 'no'} onChange={() => setAllergiesAns('no')} />
                      <span>No</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="allergies" value="yes" checked={allergiesAns === 'yes'} onChange={() => setAllergiesAns('yes')} />
                      <span>Sí</span>
                    </label>
                  </div>
                </div>

                <div>
                  <span className="font-semibold block text-white mb-1">¿Tomas medicación anticoagulante o padeces problemas de coagulación o dérmicos?</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="medication" value="no" checked={medicationAns === 'no'} onChange={() => setMedicationAns('no')} />
                      <span>No</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="medication" value="yes" checked={medicationAns === 'yes'} onChange={() => setMedicationAns('yes')} />
                      <span>Sí</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Digital Signature Canvas */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-ink-300 uppercase tracking-wider">
                    Firma Digital (con dedo o ratón) *
                  </label>
                  <button
                    type="button"
                    onClick={() => signaturePadRef.current?.clear()}
                    className="text-[11px] text-crimson-400 hover:text-crimson-300 underline"
                  >
                    Borrar firma
                  </button>
                </div>
                <div className="rounded-2xl border border-white/20 bg-ink-950 overflow-hidden shadow-inner">
                  <canvas ref={canvasRef} className="w-full cursor-crosshair touch-none" />
                </div>
              </div>

              <div className="text-[11px] text-ink-500 leading-tight">
                Al pulsar confirmar, aceptas que tu firma y los datos técnicos de verificación (IP y timestamp) quedarán registrados legalmente conforme a la normativa sanitaria.
              </div>

              <button
                type="submit"
                disabled={signingConsent}
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-ink-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02]"
              >
                {signingConsent ? 'Registrando firma legal...' : 'Firmar Consentimiento Informado'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RESCHEDULE APPOINTMENT MODAL */}
      {rescheduleModalApp && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 sm:p-8 rounded-3xl border border-[#c9bb92]/25 bg-ink-950/95 relative shadow-2xl">
            <button
              onClick={() => setRescheduleModalApp(null)}
              className="absolute top-5 right-5 text-ink-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-ink-400 mb-3">
              <span>Cambiar fecha</span>
              <span className="h-px w-10 bg-ink-600/60" />
            </div>
            <h2 className="font-display text-3xl font-medium text-white mb-2">Cambia tu <em className="italic text-crimson-400">cita</em></h2>
            <p className="text-sm text-ink-300 mb-6">
              Tu {rescheduleModalApp.appointment_type === 'design_consultation' ? 'consulta de diseño' : 'sesión de tatuaje'} con <span className="text-white">{rescheduleModalApp.artists?.display_name || 'tu tatuador'}</span>. Elige otro día y te lo confirmamos.
            </p>

            <form onSubmit={handleRescheduleAppointment} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-ink-300 uppercase tracking-wider mb-1.5">Nuevo día</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <button
                    type="button"
                    onClick={() => applyQuickRescheduleDate(1)}
                    className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/10 text-xs text-ink-200 hover:text-white border border-white/10 transition-colors"
                  >
                    Mañana
                  </button>
                  <button
                    type="button"
                    onClick={() => applyNextDayOfWeek(5)}
                    className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/10 text-xs text-ink-200 hover:text-white border border-white/10 transition-colors"
                  >
                    El viernes
                  </button>
                  <button
                    type="button"
                    onClick={() => applyNextDayOfWeek(6)}
                    className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/10 text-xs text-ink-200 hover:text-white border border-white/10 transition-colors"
                  >
                    El sábado
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickRescheduleDate(7)}
                    className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/10 text-xs text-ink-200 hover:text-white border border-white/10 transition-colors"
                  >
                    En una semana
                  </button>
                </div>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-ink-900 border border-white/10 text-white text-sm focus:outline-none focus:border-crimson-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-300 uppercase tracking-wider mb-1.5">Hora</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {['10:00', '11:30', '15:00', '16:30', '18:00'].map((timeStr) => (
                    <button
                      key={timeStr}
                      type="button"
                      onClick={() => setRescheduleTime(timeStr)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                        rescheduleTime === timeStr
                          ? 'bg-crimson-600 text-white border-crimson-500'
                          : 'bg-white/[0.04] text-ink-200 hover:text-white border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {timeStr}
                    </button>
                  ))}
                </div>
                <input
                  type="time"
                  required
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-ink-900 border border-white/10 text-white text-sm focus:outline-none focus:border-crimson-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-300 uppercase tracking-wider mb-1.5">¿Quieres contarle algo? <span className="normal-case tracking-normal text-ink-500">(opcional)</span></label>
                <input
                  type="text"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Por ejemplo: me ha surgido algo en el trabajo"
                  className="w-full px-4 py-2 rounded-xl bg-ink-900 border border-white/10 text-white text-sm focus:outline-none focus:border-crimson-500"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setRescheduleModalApp(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-ink-300 hover:text-white font-semibold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={rescheduleSubmitting}
                  className="flex-1 py-3 rounded-xl bg-crimson-600 hover:bg-crimson-700 text-white font-semibold text-sm transition-colors"
                >
                  {rescheduleSubmitting ? 'Guardando…' : 'Guardar nueva fecha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL APPOINTMENT MODAL */}
      {cancelModalApp && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 sm:p-8 rounded-3xl border border-[#c9bb92]/25 bg-ink-950/95 relative shadow-2xl">
            <button
              onClick={() => setCancelModalApp(null)}
              className="absolute top-5 right-5 text-ink-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-ink-400 mb-3">
              <span>Cancelar cita</span>
              <span className="h-px w-10 bg-ink-600/60" />
            </div>
            <h2 className="font-display text-3xl font-medium text-white mb-2">¿Seguro que quieres <em className="italic text-crimson-400">cancelar</em>?</h2>
            <p className="text-sm text-ink-300 mb-5">
              Tienes cita con <span className="text-white">{cancelModalApp.artists?.display_name || 'tu tatuador'}</span> el{' '}
              <span className="text-white font-semibold">
                {new Date(cancelModalApp.start_time).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} a las {new Date(cancelModalApp.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </span>.
            </p>

            {/* Retention Suggestion */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-[#c9bb92]/20 mb-5 text-sm">
              <p className="font-display text-lg text-white mb-1">¿Solo te viene mal el día?</p>
              <p className="text-ink-300 mb-3">Puedes cambiar la fecha sin coste y mantener tu hueco con el tatuador.</p>
              <button
                type="button"
                onClick={() => {
                  const appToReschedule = cancelModalApp;
                  setCancelModalApp(null);
                  setRescheduleModalApp(appToReschedule);
                  const curDate = appToReschedule.start_time ? appToReschedule.start_time.split('T')[0] : '';
                  const curTime = appToReschedule.start_time ? new Date(appToReschedule.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '11:00';
                  setRescheduleDate(curDate);
                  setRescheduleTime(curTime);
                }}
                className="w-full py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-700 text-white font-semibold transition-colors text-sm flex items-center justify-center gap-1.5"
              >
                <span>Cambiar la fecha</span>
              </button>
            </div>

            <form onSubmit={handleConfirmCancel} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-ink-300 uppercase tracking-wider mb-1.5">
                  ¿Por qué cancelas?
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-ink-900 border border-white/10 text-white text-sm focus:outline-none focus:border-crimson-500"
                >
                  <option value="Imprevisto laboral o personal">Imprevisto laboral o personal</option>
                  <option value="Cambio de idea con el diseño o proyecto">Cambio de idea con el diseño o proyecto</option>
                  <option value="Motivo médico o de piel">Motivo médico o de piel</option>
                  <option value="Problema económico">Problema económico</option>
                  <option value="Otro motivo">Otro motivo</option>
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setCancelModalApp(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-ink-300 hover:text-white font-semibold text-sm transition-all"
                >
                  Mantener mi cita
                </button>
                <button
                  type="submit"
                  disabled={cancelSubmitting}
                  className="flex-1 py-3 rounded-xl border border-[#c98a78]/40 text-[#e0a896] hover:bg-[#c98a78]/10 font-semibold text-sm transition-colors"
                >
                  {cancelSubmitting ? 'Cancelando…' : 'Sí, cancelar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLEAR CHAT CONFIRMATION MODAL */}
      {showClearChatModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 sm:p-8 rounded-3xl border border-red-500/30 bg-ink-950/95 relative shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2">
              ¿Estás seguro que quieres eliminar toda la conversación?
            </h3>
            <p className="text-xs text-ink-400 text-center mb-6 leading-relaxed">
              Esta acción vaciará todos los mensajes de este chat con {selectedChatArtist?.display_name || 'el artista'} de forma definitiva.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowClearChatModal(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-ink-300 hover:text-white font-semibold text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={clearingChat}
                onClick={handleClearChat}
                className="flex-1 py-3 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-bold text-sm shadow-lg shadow-crimson-600/30 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
              >
                {clearingChat ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <span>Sí, eliminar conversación</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OFFICIAL LEGAL CONSENT DOCUMENT VIEWER & PDF PRINTER */}
      <ConsentDocumentModal
        isOpen={Boolean(viewConsentModalApp)}
        onClose={() => setViewConsentModalApp(null)}
        consent={viewConsentModalApp?.consent_forms?.[0]}
        appointment={viewConsentModalApp}
        studioName={viewConsentModalApp?.studios?.name}
        studioAddress={viewConsentModalApp?.studios?.address}
        artistName={viewConsentModalApp?.artists?.display_name}
      />
    </div>
  );
}
