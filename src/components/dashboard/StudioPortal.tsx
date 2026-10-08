'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NumberField from '@/components/NumberField';
import ArtistPortal from '@/components/dashboard/ArtistPortal';
import {
  Users,
  Clock,
  Mail,
  Star,
  Plus,
  Save,
  CheckCircle2,
  Calendar,
  Percent,
  Sparkles,
  Copy,
  ExternalLink,
  X,
  LogIn,
  UserCheck,
  MapPin,
  CreditCard,
  ShieldCheck,
  Pencil,
  Trash2,
  AlertTriangle,
  ArrowRightLeft
} from 'lucide-react';
import StudioMapView from '@/components/dashboard/StudioMapView';

const DEFAULT_REMINDER_SUBJECT = '🔔 Recordatorio de tu cita en {studio_name} para el {date}';
const DEFAULT_REMINDER_BODY = `¡Hola {client_name}! Te recordamos tu cita de {appointment_type} programada para el {date} a las {time} con {artist_name} en {studio_name} ({studio_address}).

Consejos importantes antes de acudir:
• Ven bien hidratado/a y descansado/a.
• Come algo nutritivo 1 hora antes de la cita.
• No consumas alcohol ni anticoagulantes en las 24 horas previas.
• Viste ropa cómoda que permita acceso cómodo a la zona a tatuar.

{consent_status}
Puedes revisar o firmar tu consentimiento aquí: {consent_url}

¡Nos vemos pronto!`;

const DEFAULT_NEWSLETTER_SUBJECT = '🔥 Nuevos flashes y trabajos del mes en {studio_name} - {artist_name}';
const DEFAULT_NEWSLETTER_BODY = `¡Hola {client_name}! Esperamos que tu piel luzca increíble.

Este mes, {artist_name} ha preparado {works_count} nuevos diseños exclusivos y flashes disponibles en el estudio.

{works_summary}

Puedes ver todos los diseños en alta resolución y reservar tu próximo flash antes de que se agote en:
{gallery_link}

¿Tienes una nueva idea en mente? Recuerda que puedes pedir presupuesto directamente desde la web.`;

const DEFAULT_REENGAGEMENT_SUBJECT = '🖤 ¿Ganas de nueva tinta, {client_name}? Te regalamos un {discount_percent}% de descuento';
const DEFAULT_REENGAGEMENT_BODY = `¡Hola {client_name}!

Ya han pasado 4 meses desde tu última sesión de tatuaje en {studio_name} con {artist_name} y queríamos saber cómo va tu tatuaje.

Si estás pensando en una nueva pieza, un repaso o añadir complementos a tu diseño, queremos premiar tu fidelidad:
👉 Usa tu código exclusivo: {discount_code}
👉 Disfruta de un {discount_percent}% de descuento en tu próxima reserva.

Puedes solicitar cita o consultar tu idea directamente aquí:
{booking_link}

¡Un abrazo del equipo de {studio_name}!`;

export default function StudioPortal({ user, profile }: { user: any; profile: any }) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'artists' | 'schedule' | 'location' | 'emails' | 'subscription' | 'reviews'>('artists');
  const [studio, setStudio] = useState<any>(null);
  const [artists, setArtists] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stripe Subscription State
  const [subscribingStripe, setSubscribingStripe] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [showSubscribedBanner, setShowSubscribedBanner] = useState(false);

  useEffect(() => {
    if (searchParams?.get('subscribed') === 'true') {
      setShowSubscribedBanner(true);
    }
    if (searchParams?.get('setup_subscription') === '1') {
      setActiveTab('subscription');
    }
  }, [searchParams]);

  // Active Persona Switcher (Studio vs specific Artist console)
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);

  // New Artist Modal State
  const [isNewArtistOpen, setIsNewArtistOpen] = useState(false);
  const [newArtistName, setNewArtistName] = useState('');
  const [newArtistSpecialties, setNewArtistSpecialties] = useState('');
  const [newArtistHourlyRate, setNewArtistHourlyRate] = useState(80);
  const [newArtistMinFee, setNewArtistMinFee] = useState(60);
  const [newArtistInstagram, setNewArtistInstagram] = useState('');
  const [creatingArtist, setCreatingArtist] = useState(false);

  // Edit Artist State
  const [editingArtist, setEditingArtist] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editSpecialties, setEditSpecialties] = useState('');
  const [editHourlyRate, setEditHourlyRate] = useState(80);
  const [editMinFee, setEditMinFee] = useState(60);
  const [editInstagram, setEditInstagram] = useState('');
  const [savingEditArtist, setSavingEditArtist] = useState(false);

  // Delete Artist State (with double confirmation & safety coverage)
  const [deletingArtist, setDeletingArtist] = useState<any>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [reassignTargetArtistId, setReassignTargetArtistId] = useState<string>('');
  const [deleteConfirmedCheckbox, setDeleteConfirmedCheckbox] = useState(false);
  const [isDeletingArtist, setIsDeletingArtist] = useState(false);

  // Email Templates State
  const [reminderSubject, setReminderSubject] = useState(DEFAULT_REMINDER_SUBJECT);
  const [reminderBody, setReminderBody] = useState(DEFAULT_REMINDER_BODY);
  const [newsletterSubject, setNewsletterSubject] = useState(DEFAULT_NEWSLETTER_SUBJECT);
  const [newsletterBody, setNewsletterBody] = useState(DEFAULT_NEWSLETTER_BODY);
  const [reengagementSubject, setReengagementSubject] = useState(DEFAULT_REENGAGEMENT_SUBJECT);
  const [reengagementBody, setReengagementBody] = useState(DEFAULT_REENGAGEMENT_BODY);
  const [discountCode, setDiscountCode] = useState('TATOO4M');
  const [discountPercent, setDiscountPercent] = useState(10);
  const [savingEmails, setSavingEmails] = useState(false);

  // EmailJS Code Viewer Modal
  const [isEmailJsModalOpen, setIsEmailJsModalOpen] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);

  // Opening Hours State (Monday to Sunday)
  const [openingHours, setOpeningHours] = useState<any>({
    monday: { open: '10:00', close: '20:00', closed: false },
    tuesday: { open: '10:00', close: '20:00', closed: false },
    wednesday: { open: '10:00', close: '20:00', closed: false },
    thursday: { open: '10:00', close: '20:00', closed: false },
    friday: { open: '10:00', close: '20:00', closed: false },
    saturday: { open: '11:00', close: '19:00', closed: false },
    sunday: { open: '00:00', close: '00:00', closed: true },
  });
  const [savingHours, setSavingHours] = useState(false);

  const supabase = createClient();

  const handleStripeCheckout = async () => {
    if (!studio) return;
    setSubscribingStripe(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studioId: studio.id,
          userId: user.id,
          userEmail: user.email,
          studioName: studio.name
        })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Error al iniciar checkout');
      }
    } catch (err: any) {
      alert(`Error con Stripe: ${err.message}`);
    } finally {
      setSubscribingStripe(false);
    }
  };

  const handleStripePortal = async () => {
    if (!studio) return;
    setOpeningPortal(true);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studioId: studio.id,
          userId: user.id
        })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Error al abrir el portal de Stripe');
      }
    } catch (err: any) {
      alert(`Error al abrir portal de facturación: ${err.message}`);
    } finally {
      setOpeningPortal(false);
    }
  };

  useEffect(() => {
    loadStudioData();
  }, []);

  const loadStudioData = async () => {
    setLoading(true);
    try {
      // 1. Fetch studio record
      const { data: std } = await supabase
        .from('studios')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (std) {
        setStudio(std);
        if (std.opening_hours) setOpeningHours(std.opening_hours);

        const emailTpl = std.email_templates || {};
        setReminderSubject(emailTpl.reminder_subject || DEFAULT_REMINDER_SUBJECT);
        setReminderBody(emailTpl.reminder_body || DEFAULT_REMINDER_BODY);
        setNewsletterSubject(emailTpl.newsletter_subject || DEFAULT_NEWSLETTER_SUBJECT);
        setNewsletterBody(emailTpl.newsletter_body || DEFAULT_NEWSLETTER_BODY);
        setReengagementSubject(emailTpl.reengagement_subject || DEFAULT_REENGAGEMENT_SUBJECT);
        setReengagementBody(emailTpl.reengagement_body || DEFAULT_REENGAGEMENT_BODY);
        setDiscountCode(emailTpl.discount_code || 'TATOO4M');
        setDiscountPercent(emailTpl.discount_percent ?? 10);

        // 2. Fetch studio artists
        const { data: arts } = await supabase
          .from('artists')
          .select('*')
          .eq('studio_id', std.id);
        setArtists(arts || []);

        // 3. Fetch reviews
        const { data: revs } = await supabase
          .from('reviews')
          .select(`
            *,
            clients (profiles (full_name)),
            artists (display_name)
          `)
          .eq('studio_id', std.id)
          .order('created_at', { ascending: false });
        setReviews(revs || []);
      }
    } catch (err) {
      console.error('Error loading studio portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Add new artist to studio
  const handleCreateArtist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studio || !newArtistName.trim()) return;
    setCreatingArtist(true);

    try {
      const { data: createdArt, error } = await supabase
        .from('artists')
        .insert({
          profile_id: user.id, // Associated to this studio account
          studio_id: studio.id,
          display_name: newArtistName.trim(),
          specialties: newArtistSpecialties ? newArtistSpecialties.split(',').map(s => s.trim()) : [],
          hourly_rate: Number(newArtistHourlyRate) || 80,
          minimum_fee: Number(newArtistMinFee) || 60,
          instagram_handle: newArtistInstagram.trim() || null,
          pricing_rules: {
            minimum_fee: Number(newArtistMinFee) || 60,
            hourly_rate: Number(newArtistHourlyRate) || 80,
            size_rates: {
              small: { max_cm: 5, base_price: Number(newArtistMinFee) || 60 },
              medium: { max_cm: 15, base_price: 140 },
              large: { max_cm: 25, base_price: 260 },
              xlarge: { max_cm: 999, base_price: 450 }
            },
            color_multiplier: 1.25,
            complex_placement_multiplier: 1.15
          }
        })
        .select()
        .single();

      if (error) throw error;

      setArtists(prev => [...prev, createdArt]);
      setIsNewArtistOpen(false);
      setNewArtistName('');
      setNewArtistSpecialties('');
      setNewArtistInstagram('');
      alert(`¡Tatuador "${createdArt.display_name}" añadido al estudio con éxito! Ya puedes entrar en su consola.`);
    } catch (err: any) {
      alert(`Error al añadir tatuador: ${err.message}`);
    } finally {
      setCreatingArtist(false);
    }
  };

  // Open edit artist modal
  const handleOpenEditArtist = (art: any) => {
    setEditingArtist(art);
    setEditName(art.display_name || '');
    setEditSpecialties(Array.isArray(art.specialties) ? art.specialties.join(', ') : '');
    const currentMin = art.pricing_rules?.minimum_fee ?? art.minimum_fee ?? 60;
    const currentHourly = art.pricing_rules?.hourly_rate ?? art.hourly_rate ?? 80;
    setEditMinFee(currentMin);
    setEditHourlyRate(currentHourly);
    setEditInstagram(art.instagram_handle || '');
  };

  // Save edited artist
  const handleSaveEditArtist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArtist) return;
    setSavingEditArtist(true);

    try {
      const res = await fetch('/api/artists/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId: editingArtist.id,
          studioId: studio?.id,
          displayName: editName.trim(),
          specialties: editSpecialties,
          hourlyRate: Number(editHourlyRate),
          minimumFee: Number(editMinFee),
          instagramHandle: editInstagram
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Error al actualizar tatuador');
      }

      setArtists(prev => prev.map(a => a.id === data.artist.id ? data.artist : a));
      setEditingArtist(null);
      alert(`¡Tatuador "${data.artist.display_name}" actualizado con éxito!`);
    } catch (err: any) {
      alert(`Error al guardar cambios: ${err.message}`);
    } finally {
      setSavingEditArtist(false);
    }
  };

  // Open delete artist modal
  const handleOpenDeleteArtist = (art: any) => {
    setDeletingArtist(art);
    setDeleteStep(1);
    setReassignTargetArtistId('');
    setDeleteConfirmedCheckbox(false);
  };

  // Execute delete artist with double confirmation & coverage
  const handleExecuteDeleteArtist = async () => {
    if (!deletingArtist || !studio) return;
    setIsDeletingArtist(true);

    try {
      const res = await fetch('/api/artists/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId: deletingArtist.id,
          studioId: studio.id,
          reassignToArtistId: reassignTargetArtistId || undefined
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Error al eliminar tatuador');
      }

      setArtists(prev => prev.filter(a => a.id !== deletingArtist.id));
      if (selectedArtistId === deletingArtist.id) {
        setSelectedArtistId(null);
      }
      setDeletingArtist(null);

      const coverageMsg = data.reassignedTo
        ? `Citas y chats transferidos a ${data.reassignedTo}.`
        : `${data.closedChatsCount} chats cerrados y citas canceladas con aviso al cliente.`;

      alert(`✅ Tatuador eliminado del estudio con éxito. ${coverageMsg}`);
    } catch (err: any) {
      alert(`Error al eliminar tatuador: ${err.message}`);
    } finally {
      setIsDeletingArtist(false);
    }
  };

  const handleSaveHours = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studio) return;
    setSavingHours(true);

    try {
      const { error } = await supabase
        .from('studios')
        .update({ opening_hours: openingHours, updated_at: new Date().toISOString() })
        .eq('id', studio.id);

      if (error) throw error;
      alert('¡Horarios de apertura del estudio actualizados con éxito!');
    } catch (err: any) {
      alert(`Error al guardar horarios: ${err.message}`);
    } finally {
      setSavingHours(false);
    }
  };

  const handleSaveEmailTemplates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studio) return;
    setSavingEmails(true);

    const updatedTemplates = {
      reminder_subject: reminderSubject,
      reminder_body: reminderBody,
      newsletter_subject: newsletterSubject,
      newsletter_body: newsletterBody,
      reengagement_subject: reengagementSubject,
      reengagement_body: reengagementBody,
      discount_code: discountCode.trim().toUpperCase(),
      discount_percent: Number(discountPercent)
    };

    try {
      const { error } = await supabase
        .from('studios')
        .update({ email_templates: updatedTemplates, updated_at: new Date().toISOString() })
        .eq('id', studio.id);

      if (error) throw error;
      alert('¡Plantillas de correo y promociones guardadas con éxito!');
    } catch (err: any) {
      alert(`Error al guardar plantillas de correo: ${err.message}`);
    } finally {
      setSavingEmails(false);
    }
  };

  const copyToClipboard = (text: string, templateKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTemplate(templateKey);
    setTimeout(() => setCopiedTemplate(null), 2000);
  };

  // If a tattoo artist is currently selected, render that artist's console
  if (selectedArtistId) {
    return (
      <ArtistPortal
        user={user}
        profile={profile}
        artistId={selectedArtistId}
        onBackToStudio={() => setSelectedArtistId(null)}
      />
    );
  }

  const daysList = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full">
      {/* Studio Header with Active Persona Switcher */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 bg-ink-900/60 p-5 rounded-3xl border border-white/5">
        <div>
          <span className="text-[11px] uppercase tracking-[0.3em] text-ink-400 font-medium flex items-center gap-3">Panel del estudio<span className="h-px w-10 bg-ink-600/60" /></span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mt-0.5">
            {studio?.name || 'Mi Estudio de Tatuaje'}
          </h1>
          <p className="text-xs text-ink-400 mt-0.5">
            {artists.length} {artists.length === 1 ? 'tatuador asociado' : 'tatuadores asociados'} · Dirección: {studio?.address || 'Por configurar'}
          </p>
        </div>

        {/* Persona Selector: "Quién eres hoy" */}
        <div className="flex items-center gap-3 bg-ink-950 p-2 rounded-2xl border border-white/10">
          <div className="flex flex-col">
            <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider px-1">¿Quién eres hoy?</span>
            <select
              value={selectedArtistId || 'studio'}
              onChange={(e) => {
                if (e.target.value === 'studio') setSelectedArtistId(null);
                else setSelectedArtistId(e.target.value);
              }}
              className="px-3 py-1.5 rounded-xl bg-ink-900 border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="studio">Vista general del estudio</option>
              <optgroup label="Tatuadores">
                {artists.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.display_name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <button
            onClick={() => setIsNewArtistOpen(true)}
            className="flex items-center gap-1.5 bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-md shadow-crimson-600/25 transition-all self-end"
            title="Añadir nuevo tatuador al estudio"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tatuador</span>
          </button>
        </div>
      </div>

      {/* Stripe Subscribed Feedback Banner */}
      {showSubscribedBanner && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-600/15 border border-emerald-500/40 text-emerald-300 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-sm text-white">¡Suscripción de Estudio Activada con Éxito!</p>
              <p className="text-xs text-ink-300">Tu cuenta cuenta con tarifa activa de 50€/mes a través de Stripe con acceso ilimitado.</p>
            </div>
          </div>
          <button onClick={() => setShowSubscribedBanner(false)} className="text-ink-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 mb-8 pb-3">
        <button
          onClick={() => setActiveTab('artists')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'artists' ? 'bg-white/10 text-white' : 'text-ink-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4 text-amber-400" />
          <span>Tatuadores ({artists.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'schedule' ? 'bg-white/10 text-white' : 'text-ink-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4 text-crimson-500" />
          <span>Horario</span>
        </button>

        <button
          onClick={() => setActiveTab('location')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'location' ? 'bg-white/10 text-white' : 'text-ink-400 hover:text-white'
          }`}
        >
          <MapPin className="w-4 h-4 text-emerald-400" />
          <span>Ubicación</span>
        </button>

        <button
          onClick={() => setActiveTab('emails')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'emails' ? 'bg-white/10 text-white' : 'text-ink-400 hover:text-white'
          }`}
        >
          <Mail className="w-4 h-4 text-blue-400" />
          <span>Emails y descuentos</span>
        </button>

        <button
          onClick={() => setActiveTab('subscription')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'subscription' ? 'bg-emerald-600/30 text-white border border-emerald-500/40' : 'text-ink-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4 text-emerald-400" />
          <span>Suscripción (50€/mes)</span>
        </button>

        <button
          onClick={() => setActiveTab('reviews')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'reviews' ? 'bg-white/10 text-white' : 'text-ink-400 hover:text-white'
          }`}
        >
          <Star className="w-4 h-4 text-amber-400" />
          <span>Reseñas ({reviews.length})</span>
        </button>
      </div>

      {/* TAB 1: ARTISTS LIST */}
      {activeTab === 'artists' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-400">
              Cada tatuador puede acceder a su espacio individual seleccionando su perfil en el menú superior o haciendo clic en <strong>Acceder a su Consola</strong>.
            </p>
            <button
              onClick={() => setIsNewArtistOpen(true)}
              className="flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold px-3.5 py-1.5 rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir Tatuador</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {artists.map((art) => {
              const effectiveMinFee = art.pricing_rules?.minimum_fee ?? art.minimum_fee ?? 60;
              const effectiveHourlyRate = art.pricing_rules?.hourly_rate ?? art.hourly_rate ?? 80;

              return (
                <div key={art.id} className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col justify-between hover:border-amber-500/30 transition-all group">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-crimson-600 to-amber-500 text-white flex items-center justify-center font-bold text-base shadow-md">
                          {art.display_name?.charAt(0) || 'A'}
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-base">{art.display_name}</h3>
                          <span className="text-xs text-ink-300">
                            Mínimo: <strong className="text-amber-400 font-mono">{effectiveMinFee}€</strong> · Hora: <strong className="text-amber-400 font-mono">{effectiveHourlyRate}€/h</strong>
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons: Edit / Delete */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditArtist(art)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-ink-400 hover:text-white transition-colors"
                          title="Editar tarifas y datos del tatuador"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteArtist(art)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-ink-400 hover:text-red-400 transition-colors"
                          title="Eliminar tatuador del estudio (requiere confirmación)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 mb-4">
                      <span className="text-[11px] text-ink-400 font-semibold block uppercase tracking-wider">Especialidades:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {art.specialties?.length > 0 ? (
                          art.specialties.map((spec: string, idx: number) => (
                            <span key={idx} className="text-[10px] bg-white/5 text-ink-300 px-2 py-0.5 rounded-md border border-white/5">
                              {spec}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-ink-500">Todos los estilos</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Asistente IA Activo
                    </span>

                    <button
                      onClick={() => setSelectedArtistId(art.id)}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white transition-all shadow-md shadow-crimson-600/20"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Acceder a su Consola</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: STUDIO OPENING HOURS */}
      {activeTab === 'schedule' && (
        <div className="max-w-2xl glass-panel p-8 rounded-3xl border border-white/10">
          <h2 className="font-display text-xl font-bold text-white mb-1">Horario General de Apertura</h2>
          <p className="text-xs text-ink-400 mb-6">
            Define los días y franjas en los que el estudio acepta citas presenciales.
          </p>

          <form onSubmit={handleSaveHours} className="space-y-3 text-xs">
            {daysList.map((day) => {
              const dayData = openingHours[day.key] || { open: '10:00', close: '20:00', closed: false };

              return (
                <div key={day.key} className="flex items-center justify-between p-3 rounded-xl bg-ink-900/70 border border-white/5">
                  <span className="font-bold text-white w-24 text-sm">{day.label}</span>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!dayData.closed}
                      onChange={(e) => {
                        setOpeningHours((prev: any) => ({
                          ...prev,
                          [day.key]: { ...dayData, closed: !e.target.checked }
                        }));
                      }}
                    />
                    <span className={dayData.closed ? 'text-crimson-400' : 'text-emerald-400 font-semibold'}>
                      {dayData.closed ? 'Cerrado' : 'Abierto'}
                    </span>
                  </label>

                  {!dayData.closed ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={dayData.open}
                        onChange={(e) => {
                          setOpeningHours((prev: any) => ({
                            ...prev,
                            [day.key]: { ...dayData, open: e.target.value }
                          }));
                        }}
                        className="bg-ink-950 border border-white/10 px-2 py-1 rounded text-white"
                      />
                      <span>a</span>
                      <input
                        type="time"
                        value={dayData.close}
                        onChange={(e) => {
                          setOpeningHours((prev: any) => ({
                            ...prev,
                            [day.key]: { ...dayData, close: e.target.value }
                          }));
                        }}
                        className="bg-ink-950 border border-white/10 px-2 py-1 rounded text-white"
                      />
                    </div>
                  ) : (
                    <span className="text-ink-500 italic">No disponible para reservas</span>
                  )}
                </div>
              );
            })}

            <button
              type="submit"
              disabled={savingHours}
              className="mt-6 w-full py-3 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-bold text-sm shadow-lg shadow-crimson-600/30 transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{savingHours ? 'Guardando...' : 'Guardar Horario de Apertura'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB LOCATION: STUDIO MAP & ADDRESS CONFIGURATION */}
      {activeTab === 'location' && studio && (
        <div className="space-y-6">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-bold uppercase mb-1">
                  <MapPin className="w-4 h-4" />
                  <span>Geo-Localización & Mapa Territorial</span>
                </div>
                <h2 className="font-display text-xl font-bold text-white">Ubicación y Cobertura de tu Estudio</h2>
                <p className="text-xs text-ink-400 mt-1 max-w-xl">
                  Configura la dirección física y la ciudad para que los clientes encuentren tu estudio en el mapa interactivo y calculen rutas directas con Google Maps.
                </p>
              </div>
            </div>

            <StudioMapView
              studios={[{
                ...studio,
                artists_count: artists.length
              }]}
              isOwnerView={true}
              onUpdateStudioAddress={async (studioId, address, city) => {
                const res = await fetch('/api/studios/update-location', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ studioId, address, city })
                });
                const data = await res.json();
                if (!res.ok || data.error) throw new Error(data.error || 'Error al actualizar dirección');
                setStudio((prev: any) => ({ ...prev, address, city }));
              }}
            />
          </div>
        </div>
      )}

      {/* TAB 3: EMAIL TEMPLATES & 4-MONTH RE-ENGAGEMENT */}
      {activeTab === 'emails' && (
        <div className="max-w-3xl glass-panel p-8 rounded-3xl border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 text-blue-400 text-xs font-mono font-bold uppercase mb-1">
                <Mail className="w-4 h-4" />
                <span>Automatización con EmailJS</span>
              </div>
              <h2 className="font-display text-xl font-bold text-white">Plantillas de Email & Promociones</h2>
            </div>

            <button
              type="button"
              onClick={() => setIsEmailJsModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-bold transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>📋 Ver Plantillas Listas para EmailJS</span>
            </button>
          </div>

          <p className="text-xs text-ink-400 mb-6 leading-relaxed">
            Personaliza el contenido de los correos automáticos. Las plantillas ya vienen precargadas por defecto con un diseño probado y profesional.
          </p>

          <form onSubmit={handleSaveEmailTemplates} className="space-y-6 text-sm">
            {/* 1. Recordatorio 48h */}
            <div className="space-y-2 p-5 rounded-2xl bg-ink-900/60 border border-white/5">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                1. Recordatorio 48 horas antes de la cita
              </span>
              <div>
                <label className="block text-xs text-ink-400 mb-1">Asunto</label>
                <input
                  type="text"
                  value={reminderSubject}
                  onChange={(e) => setReminderSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-white/10 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-1">Cuerpo del mensaje</label>
                <textarea
                  rows={4}
                  value={reminderBody}
                  onChange={(e) => setReminderBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-white/10 text-white text-xs"
                />
              </div>
            </div>

            {/* 2. Newsletter mensual */}
            <div className="space-y-2 p-5 rounded-2xl bg-ink-900/60 border border-white/5">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                2. Newsletter Mensual de Flashes & Diseños (Share)
              </span>
              <div>
                <label className="block text-xs text-ink-400 mb-1">Asunto</label>
                <input
                  type="text"
                  value={newsletterSubject}
                  onChange={(e) => setNewsletterSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-white/10 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-1">Cuerpo del mensaje</label>
                <textarea
                  rows={4}
                  value={newsletterBody}
                  onChange={(e) => setNewsletterBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-white/10 text-white text-xs"
                />
              </div>
            </div>

            {/* 3. Reactivación a los 4 meses */}
            <div className="space-y-3 p-5 rounded-2xl bg-amber-950/20 border border-amber-500/20">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                3. Correo de Reactivación (4 meses sin citas)
              </span>
              <div>
                <label className="block text-xs text-ink-400 mb-1">Asunto</label>
                <input
                  type="text"
                  value={reengagementSubject}
                  onChange={(e) => setReengagementSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-white/10 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-1">Cuerpo del mensaje</label>
                <textarea
                  rows={4}
                  value={reengagementBody}
                  onChange={(e) => setReengagementBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-white/10 text-white text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs text-amber-300 mb-1">Código de Descuento</label>
                  <input
                    type="text"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-white/10 text-white font-mono uppercase text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-amber-300 mb-1">% de Descuento</label>
                  <NumberField
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-white/10 text-white text-xs"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingEmails}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{savingEmails ? 'Guardando...' : 'Guardar Plantillas y Promociones'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB: STRIPE SUBSCRIPTION & BILLING */}
      {activeTab === 'subscription' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 bg-ink-950/70">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-white/10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                  <CreditCard className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-2xl font-bold text-white">Suscripción Estudio Tatoo Pro</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {['active', 'trialing'].includes(studio?.subscription_status || 'trialing') ? 'ACTIVA' : 'PENDIENTE'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-400 mt-1">
                    Tarifa plana oficial para estudios de tatuajes · Facturación mensual segura con Stripe
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="font-display text-3xl font-extrabold text-white">
                  50,00 € <span className="text-sm font-sans font-normal text-ink-400">/ mes</span>
                </div>
                <span className="text-[11px] text-emerald-400 font-medium">IVA incluido · Sin permanencia</span>
              </div>
            </div>

            {/* Current Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
              <div className="p-4 rounded-2xl bg-ink-900 border border-white/5">
                <span className="text-[11px] font-mono text-ink-400 block uppercase mb-1">Estado de Facturación</span>
                <span className="font-bold text-white text-sm capitalize">
                  {studio?.subscription_status === 'active' ? '✓ Activa (Pagada)' : studio?.subscription_status === 'trialing' ? 'Prueba Activa' : 'Pendiente de Activar'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-ink-900 border border-white/5">
                <span className="text-[11px] font-mono text-ink-400 block uppercase mb-1">Próxima Renovación</span>
                <span className="font-bold text-amber-300 text-sm">
                  {studio?.current_period_end ? new Date(studio.current_period_end).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Mensual continua'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-ink-900 border border-white/5">
                <span className="text-[11px] font-mono text-ink-400 block uppercase mb-1">Pasarela de Pago</span>
                <span className="font-bold text-white text-sm flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Stripe Secure Payments</span>
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleStripeCheckout}
                disabled={subscribingStripe}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all hover:scale-[1.02]"
              >
                <CreditCard className="w-4 h-4" />
                <span>{subscribingStripe ? 'Conectando con Stripe...' : 'Activar / Renovar Suscripción (50€/mes)'}</span>
              </button>

              <button
                onClick={handleStripePortal}
                disabled={openingPortal}
                className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white font-semibold text-sm border border-white/10 flex items-center gap-2 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{openingPortal ? 'Abriendo portal...' : 'Gestionar Facturación en Stripe (Recibos / Tarjeta)'}</span>
              </button>
            </div>
          </div>

          {/* Included Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-white/5">
              <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Beneficios de tu Suscripción Profesional (50€/mes)</span>
              </h3>
              <ul className="space-y-2.5 text-xs text-ink-300">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span><strong>Tatuadores Ilimitados:</strong> Da de alta todos los artistas residentes y colaboradores del estudio sin costes adicionales.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span><strong>Copilot IA para cada Tatuador:</strong> Cada artista cuenta con su propio asistente virtual para consultar su agenda, bloquear descansos y verificar consentimientos.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span><strong>Chatbot con Inteligencia Artificial para Clientes:</strong> Atiende consultas 24/7, propone huecos libres y calcula presupuestos según medidas en cm.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span><strong>Consentimientos Informados Legales:</strong> Firma digital directa en pantalla, optimización en tinta oscura (#0f172a) y generación en 1 sola página A4 oficial para impresión y descarga.</span>
                </li>
              </ul>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-white/5">
              <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Herramientas de Visibilidad y Notificaciones</span>
              </h3>
              <ul className="space-y-2.5 text-xs text-ink-300">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span><strong>Mapa Interactivo CARTO:</strong> Tu estudio aparece geolocalizado en el mapa mundial de alta resolución para captar clientes en tu ciudad.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span><strong>Recordatorios 48h por Email:</strong> Reduce las inasistencias avisando a los clientes dos días antes con consejos higiénicos de preparación.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span><strong>Flashes y Promociones:</strong> Publica diseños exclusivos del mes y fideliza con campañas de reactivación tras 4 meses.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span><strong>Cancelación Libre:</strong> Sin permanencia obligatoria. Puedes pausar o cancelar tu suscripción con un solo clic desde el portal seguro de Stripe.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: REVIEWS */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reviews.length === 0 ? (
              <div className="col-span-3 glass-panel p-12 text-center rounded-2xl border border-white/5 text-ink-500 text-sm">
                Aún no hay reseñas registradas para este estudio.
              </div>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="glass-panel p-5 rounded-2xl border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-sm">{r.clients?.profiles?.full_name || 'Cliente'}</span>
                    <span className="text-amber-400 text-xs">{'★'.repeat(r.rating)}</span>
                  </div>
                  <p className="text-xs text-ink-300 mb-2 italic">"{r.comment}"</p>
                  <span className="text-[10px] text-ink-500">Tatuador: {r.artists?.display_name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: AÑADIR TATUADOR AL ESTUDIO */}
      {isNewArtistOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 sm:p-8 rounded-3xl border border-white/10 relative">
            <button
              onClick={() => setIsNewArtistOpen(false)}
              className="absolute top-5 right-5 text-ink-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="font-display text-xl font-bold text-white mb-1">Añadir Tatuador al Estudio</h2>
            <p className="text-xs text-ink-400 mb-6">
              El tatuador tendrá su propia consola para gestionar citas, chats con IA y flashes.
            </p>

            <form onSubmit={handleCreateArtist} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-ink-300 uppercase tracking-wider mb-1">
                  Nombre del Tatuador / Artístico *
                </label>
                <input
                  type="text"
                  required
                  value={newArtistName}
                  onChange={(e) => setNewArtistName(e.target.value)}
                  placeholder="Ej: Marcos Vega"
                  className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-white/10 text-white text-sm focus:outline-none focus:border-crimson-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink-300 uppercase tracking-wider mb-1">
                  Especialidades (separadas por coma)
                </label>
                <input
                  type="text"
                  value={newArtistSpecialties}
                  onChange={(e) => setNewArtistSpecialties(e.target.value)}
                  placeholder="Ej: Blackwork, Fine Line, Tradicional"
                  className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-white/10 text-white text-sm focus:outline-none focus:border-crimson-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink-300 uppercase tracking-wider mb-1">
                    Tarifa Mínima (€)
                  </label>
                  <NumberField
                    value={newArtistMinFee}
                    onChange={(e) => setNewArtistMinFee(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-white/10 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink-300 uppercase tracking-wider mb-1">
                    Precio / Hora (€)
                  </label>
                  <NumberField
                    value={newArtistHourlyRate}
                    onChange={(e) => setNewArtistHourlyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-white/10 text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink-300 uppercase tracking-wider mb-1">
                  Instagram Handle (Opcional)
                </label>
                <input
                  type="text"
                  value={newArtistInstagram}
                  onChange={(e) => setNewArtistInstagram(e.target.value)}
                  placeholder="@marcos_tattoo"
                  className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-white/10 text-white text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewArtistOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-ink-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingArtist}
                  className="px-5 py-2 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-bold"
                >
                  {creatingArtist ? 'Añadiendo...' : 'Añadir Tatuador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ARTIST */}
      {editingArtist && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 sm:p-8 rounded-3xl border border-white/10 relative">
            <button
              onClick={() => setEditingArtist(null)}
              className="absolute top-5 right-5 text-ink-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-bold uppercase mb-1">
              <Pencil className="w-4 h-4" />
              <span>Editar Ajustes del Tatuador</span>
            </div>
            <h2 className="font-display text-xl font-bold text-white mb-4">
              {editingArtist.display_name}
            </h2>

            <form onSubmit={handleSaveEditArtist} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-ink-300 uppercase tracking-wider mb-1">Nombre Artístico / Display Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-white/10 text-white text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink-300 uppercase tracking-wider mb-1">Especialidades (separadas por comas)</label>
                <input
                  type="text"
                  value={editSpecialties}
                  onChange={(e) => setEditSpecialties(e.target.value)}
                  placeholder="Realismo, Blackwork, Neotradicional"
                  className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-white/10 text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink-300 uppercase tracking-wider mb-1">Tarifa Mínima (€) *</label>
                  <NumberField
                    required
                    min={20}
                    value={editMinFee}
                    onChange={(e) => setEditMinFee(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-white/10 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink-300 uppercase tracking-wider mb-1">Precio por Hora (€) *</label>
                  <NumberField
                    required
                    min={20}
                    value={editHourlyRate}
                    onChange={(e) => setEditHourlyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-white/10 text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink-300 uppercase tracking-wider mb-1">Usuario Instagram (sin @)</label>
                <input
                  type="text"
                  value={editInstagram}
                  onChange={(e) => setEditInstagram(e.target.value)}
                  placeholder="marcos_tattoo"
                  className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-white/10 text-white text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingArtist(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-ink-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEditArtist}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-ink-950 font-bold"
                >
                  {savingEditArtist ? 'Guardando...' : 'Guardar Ajustes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE ARTIST WITH MANDATORY DOUBLE CONFIRMATION & CLIENT COVERAGE */}
      {deletingArtist && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 sm:p-8 rounded-3xl border border-red-500/30 bg-ink-950 relative shadow-2xl">
            <button
              onClick={() => setDeletingArtist(null)}
              className="absolute top-5 right-5 text-ink-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>

            {/* STEP 1: CLIENT COVERAGE & NOTICE MANAGEMENT */}
            {deleteStep === 1 && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">Paso 1 de 2 · Cobertura de clientes</span>
                    <h3 className="text-xl font-bold text-white">Desvincular a {deletingArtist.display_name}</h3>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-ink-300 space-y-2">
                  <p className="font-semibold text-white">
                    🛡️ Protocolo de Protección al Cliente:
                  </p>
                  <p>
                    Antes de eliminar a este tatuador, el sistema cerrará manualmente todos sus canales de chat para no dejar a los clientes sin respuesta.
                  </p>
                  <p>
                    ¿Qué deseas hacer con las citas activas y clientes de <strong>{deletingArtist.display_name}</strong>?
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Option A: Reassign to another artist */}
                  {artists.filter(a => a.id !== deletingArtist.id).length > 0 && (
                    <label className={`block p-4 rounded-2xl border cursor-pointer transition-all ${
                      reassignTargetArtistId ? 'bg-amber-500/10 border-amber-500/40 text-white' : 'bg-ink-900 border-white/5 text-ink-300 hover:border-white/10'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-white flex items-center gap-2">
                          <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                          Reasignar citas y cobertura a otro tatuador (Recomendado)
                        </span>
                      </div>
                      <p className="text-xs text-ink-400 mb-3">
                        Transfiere automáticamente las citas y chats al artista seleccionado, enviando un mensaje informativo al cliente para no dejarlo sin cobertura.
                      </p>
                      <select
                        value={reassignTargetArtistId}
                        onChange={(e) => setReassignTargetArtistId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-500"
                      >
                        <option value="">Selecciona el tatuador que asumirá la cobertura...</option>
                        {artists.filter(a => a.id !== deletingArtist.id).map(a => (
                          <option key={a.id} value={a.id}>
                            {a.display_name} {a.specialties?.length ? `(${a.specialties.join(', ')})` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {/* Option B: Cancel all appointments and close chats */}
                  <label className={`block p-4 rounded-2xl border cursor-pointer transition-all ${
                    !reassignTargetArtistId ? 'bg-red-500/10 border-red-500/40 text-white' : 'bg-ink-900 border-white/5 text-ink-400 hover:border-white/10'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-red-400" />
                        Cancelar todas sus citas y cerrar chats
                      </span>
                      <input
                        type="radio"
                        checked={!reassignTargetArtistId}
                        onChange={() => setReassignTargetArtistId('')}
                        name="delete_coverage_option"
                      />
                    </div>
                    <p className="text-xs text-ink-400 mt-1">
                      Las citas pendientes se anularán en el sistema y se cerrará el asistente IA de sus chats con un aviso formal al cliente.
                    </p>
                  </label>
                </div>

                <div className="pt-3 border-t border-white/10 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDeletingArtist(null)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-ink-300 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteStep(2)}
                    className="px-5 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-bold shadow-lg shadow-crimson-600/30 transition-all flex items-center gap-2"
                  >
                    <span>Continuar hacia la Confirmación Definitiva</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: MANDATORY SECOND CONFIRMATION ("¿Estás seguro de que quieres...?") */}
            {deleteStep === 2 && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-600/20 text-red-400 flex items-center justify-center font-bold">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest font-bold">Paso 2 de 2 · Segunda Confirmación Obligatoria</span>
                    <h3 className="text-xl font-bold text-white">¿Estás seguro de que quieres eliminar a este tatuador?</h3>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/40 text-xs space-y-2">
                  <p className="font-bold text-red-300">
                    ⚠️ Estás a punto de eliminar definitivamente a "{deletingArtist.display_name}".
                  </p>
                  <p className="text-ink-300">
                    {reassignTargetArtistId
                      ? `Se reasignarán todas sus citas activas y chats al tatuador seleccionado para proteger la cobertura.`
                      : `Se cancelarán todas las citas pendientes y se cerrarán todos sus chats en la app.`}
                  </p>
                  <p className="text-ink-400 text-[11px]">
                    Esta acción es irreversible y retirará el acceso a la consola del tatuador.
                  </p>
                </div>

                <label className="flex items-start gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 cursor-pointer text-xs text-ink-200">
                  <input
                    type="checkbox"
                    checked={deleteConfirmedCheckbox}
                    onChange={(e) => setDeleteConfirmedCheckbox(e.target.checked)}
                    className="mt-0.5 rounded bg-ink-950 border-white/20 text-crimson-600 focus:ring-0"
                  />
                  <span>
                    He verificado los avisos y confirmo expresamente la eliminación definitiva de <strong>{deletingArtist.display_name}</strong> de mi estudio.
                  </span>
                </label>

                <div className="pt-3 border-t border-white/10 flex justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteStep(1)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-ink-300 text-xs font-semibold"
                  >
                    ← Volver atrás
                  </button>
                  <button
                    type="button"
                    disabled={!deleteConfirmedCheckbox || isDeletingArtist}
                    onClick={handleExecuteDeleteArtist}
                    className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:pointer-events-none text-white text-xs font-bold shadow-lg shadow-red-600/30 transition-all flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isDeletingArtist ? 'Eliminando y asegurando clientes...' : 'Sí, eliminar tatuador definitivamente'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: VISOR DE PLANTILLAS PARA EMAILJS */}
      {isEmailJsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-3xl p-6 sm:p-8 rounded-3xl border border-white/10 relative max-h-[88vh] overflow-y-auto">
            <button
              onClick={() => setIsEmailJsModalOpen(false)}
              className="absolute top-5 right-5 text-ink-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-purple-400 text-xs font-mono font-bold uppercase mb-1">
              <Mail className="w-4 h-4" />
              <span>Plantillas EmailJS Oficiales</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">Código para EmailJS</h2>
            <p className="text-xs text-ink-400 mb-6">
              Copia y pega este código HTML en el editor de plantillas de tu cuenta de EmailJS.
            </p>

            <div className="space-y-6 text-xs">
              {/* Plantilla 1 */}
              <div className="p-4 rounded-2xl bg-ink-950 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-amber-400 text-sm">1. Recordatorio de Cita (48h)</span>
                  <button
                    onClick={() => copyToClipboard(`<!-- Plantilla 48h para EmailJS -->
<div style="font-family: Arial, sans-serif; background-color: #0b0c0e; color: #f8f9fa; padding: 30px 20px; max-width: 600px; margin: 0 auto; border-radius: 16px; border: 1px solid #262930;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="color: #e63946; margin: 0; font-size: 26px;">{{studio_name}}</h1>
    <p style="color: #adb5bd; font-size: 13px;">Recordatorio de tu próxima sesión</p>
  </div>
  <div style="background-color: #131519; padding: 25px; border-radius: 12px;">
    <h2 style="color: #ffffff; font-size: 18px;">¡Hola, {{client_name}}!</h2>
    <p style="color: #ced4da; font-size: 14px; line-height: 1.6;">
      Te recordamos tu cita de <strong>{{appointment_type}}</strong> con <strong>{{artist_name}}</strong> en <strong>{{studio_name}}</strong>.
    </p>
    <div style="background-color: #0b0c0e; padding: 15px; border-radius: 8px; border-left: 4px solid #e63946;">
      <p style="margin: 4px 0;">📅 <strong>Fecha:</strong> {{appointment_date}}</p>
      <p style="margin: 4px 0;">⏰ <strong>Hora:</strong> {{appointment_time}}</p>
      <p style="margin: 4px 0;">📍 <strong>Dirección:</strong> {{studio_address}}</p>
    </div>
    <div style="margin-top: 25px; text-align: center;">
      <p style="color: #fbbf24; font-weight: bold;">{{consent_status}}</p>
      <a href="{{consent_url}}" style="display: inline-block; background-color: #e63946; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
        Firmar Consentimiento Informado Online
      </a>
    </div>
  </div>
</div>`, 'reminder')}
                    className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedTemplate === 'reminder' ? '¡Copiado!' : 'Copiar HTML'}</span>
                  </button>
                </div>
                <span className="text-ink-400 block mb-2 font-mono">Template ID: <code>template_reminder_48h</code></span>
              </div>

              {/* Plantilla 2 */}
              <div className="p-4 rounded-2xl bg-ink-950 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-purple-400 text-sm">2. Newsletter Mensual de Flashes (Share)</span>
                  <button
                    onClick={() => copyToClipboard(`<!-- Plantilla Newsletter para EmailJS -->
<div style="font-family: Arial, sans-serif; background-color: #0b0c0e; color: #f8f9fa; padding: 30px 20px; max-width: 600px; margin: 0 auto; border-radius: 16px; border: 1px solid #262930;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="color: #e63946; margin: 0; font-size: 26px;">{{studio_name}}</h1>
    <p style="color: #adb5bd; font-size: 13px;">Nuevos flashes de {{artist_name}}</p>
  </div>
  <div style="background-color: #131519; padding: 25px; border-radius: 12px;">
    <h2 style="color: #ffffff; font-size: 18px;">¡Hola, {{client_name}}!</h2>
    <p style="color: #ced4da; font-size: 14px; line-height: 1.6;">
      Este mes, <strong>{{artist_name}}</strong> ha publicado <strong>{{works_count}} nuevos diseños exclusivos</strong> en el estudio.
    </p>
    <div style="background-color: #0b0c0e; padding: 15px; border-radius: 8px;">
      <p style="color: #f8f9fa; white-space: pre-line; margin: 0;">{{works_summary}}</p>
    </div>
    <div style="text-align: center; margin-top: 25px;">
      <a href="{{gallery_link}}" style="display: inline-block; background-color: #7928ca; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
        Ver Galería y Reservar Flash
      </a>
    </div>
  </div>
</div>`, 'newsletter')}
                    className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedTemplate === 'newsletter' ? '¡Copiado!' : 'Copiar HTML'}</span>
                  </button>
                </div>
                <span className="text-ink-400 block mb-2 font-mono">Template ID: <code>template_newsletter_monthly</code></span>
              </div>

              {/* Plantilla 3 */}
              <div className="p-4 rounded-2xl bg-ink-950 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-crimson-400 text-sm">3. Reactivación a los 4 Meses (Descuento)</span>
                  <button
                    onClick={() => copyToClipboard(`<!-- Plantilla Reactivación 4 Meses para EmailJS -->
<div style="font-family: Arial, sans-serif; background-color: #0b0c0e; color: #f8f9fa; padding: 30px 20px; max-width: 600px; margin: 0 auto; border-radius: 16px; border: 1px solid #262930;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="color: #e63946; margin: 0; font-size: 26px;">{{studio_name}}</h1>
    <p style="color: #adb5bd; font-size: 13px;">Te echamos de menos</p>
  </div>
  <div style="background-color: #131519; padding: 25px; border-radius: 12px;">
    <h2 style="color: #ffffff; font-size: 18px;">¡Hola, {{client_name}}!</h2>
    <p style="color: #ced4da; font-size: 14px; line-height: 1.6;">
      Han pasado 4 meses desde tu última sesión de tatuaje con <strong>{{artist_name}}</strong> en <strong>{{studio_name}}</strong>.
    </p>
    <div style="background: rgba(251,191,36,0.1); border: 2px dashed #fbbf24; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
      <span style="font-size: 12px; color: #fbbf24; font-weight: bold;">Tu código exclusivo:</span>
      <span style="display: block; font-size: 26px; font-weight: bold; color: #ffffff; margin: 6px 0; font-family: monospace;">{{discount_code}}</span>
      <span style="font-size: 14px; color: #f8f9fa;">Disfruta de un <strong>{{discount_percent}} de descuento</strong> en tu próxima reserva.</span>
    </div>
    <div style="text-align: center; margin-top: 25px;">
      <a href="{{booking_link}}" style="display: inline-block; background-color: #e63946; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
        Pedir Cita con Descuento
      </a>
    </div>
  </div>
</div>`, 'reengagement')}
                    className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedTemplate === 'reengagement' ? '¡Copiado!' : 'Copiar HTML'}</span>
                  </button>
                </div>
                <span className="text-ink-400 block mb-2 font-mono">Template ID: <code>template_reengagement_4m</code></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
