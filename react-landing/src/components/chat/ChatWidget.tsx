import { useEffect, useRef, useState } from 'react';
import { useChatSession } from '../../hooks/useChatSession';
import type { AgentMessageVariant } from '../../hooks/useChatSession';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { ChatLauncher } from './ChatLauncher';
import { ChatWindow } from './ChatWindow';

export function ChatWidget() {
  const session = useChatSession();
  const reducedMotion = usePrefersReducedMotion();
  const [entered, setEntered] = useState(false);
  const greetedRef = useRef(false);
  const geoCoordsRef = useRef<{ lat: number; long: number } | null>(null);
  const geoRequestedRef = useRef(false);

  useEffect(() => {
    if (!session.isOpen) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [session.isOpen]);

  useEffect(() => {
    if (!session.isOpen || greetedRef.current || session.messages.length > 0 || !session.sessionId) return;
    greetedRef.current = true;
    session.appendAgentMessage({
      kind: 'text',
      text: "Hi! I'm the Divine Vision concierge — ask me anything about our townships, or tap Request Callback / Call Now if you'd rather talk to our team directly.",
    });
    // Only re-evaluate when these specific fields change — `session` itself
    // is a new object on every dispatch (every keystroke, mic-state change,
    // etc.), which would otherwise re-run this effect far more than needed.
  }, [session.isOpen, session.sessionId, session.messages.length, session.appendAgentMessage]);

  // Ask for location proactively, once, as soon as the visitor opens the
  // chat — rather than waiting for the AI to phrase a reply a specific way
  // (which rarely happened in practice, so the browser's permission prompt
  // was effectively never shown). This is the same "silent capture" timing
  // as session/init, just gated on opening the widget instead of firing for
  // every page load. Coordinates ride along with the visitor's next message
  // (see withPendingGeo below) so they reach the backend/lead alongside real
  // conversational activity rather than as an isolated, contextless call.
  useEffect(() => {
    if (!session.isOpen || geoRequestedRef.current) return;
    if (!('geolocation' in navigator)) return;
    geoRequestedRef.current = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        geoCoordsRef.current = { lat: position.coords.latitude, long: position.coords.longitude };
      },
      () => {
        // Denied or unavailable — continue silently, no error message.
      },
      { timeout: 8000 },
    );
  }, [session.isOpen]);

  const withPendingGeo = (extra: { message?: string; audio?: Blob }) => {
    const coords = geoCoordsRef.current;
    geoCoordsRef.current = null;
    return coords ? { ...extra, lat: coords.lat, long: coords.long } : extra;
  };

  const handleSendText = (text: string) => {
    void session.send(withPendingGeo({ message: text }));
  };

  const handleSendAudio = (audio: Blob) => {
    // Wait for the send to settle before leaving 'transcribing' — resetting
    // immediately would overwrite the state MicButton just set and hide the
    // transcribing indicator before the backend has actually responded.
    void session.send(withPendingGeo({ audio })).finally(() => session.setMicState('idle'));
  };

  const handleRequestCallback = () => {
    void session.send({ intent: 'request_callback' });
  };

  const handleDesktopContactCard = (variant: AgentMessageVariant) => {
    session.appendAgentMessage(variant);
  };

  const micDeniedHintShown = useRef(false);
  const handleMicPermissionDenied = () => {
    if (micDeniedHintShown.current) return;
    micDeniedHintShown.current = true;
    session.appendAgentMessage({ kind: 'text', text: "Voice isn't available right now — you can type instead." });
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {session.isOpen && (
        <div
          className={
            reducedMotion
              ? ''
              : `transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  entered ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-[0.97] opacity-0'
                }`
          }
        >
          <ChatWindow
            messages={session.messages}
            isSending={session.isSending}
            interimStatusLine={session.interimStatusLine}
            consentShown={session.consentShown}
            callbackFlowActive={session.callbackFlowActive}
            micState={session.micState}
            onClose={session.close}
            onDismissConsent={session.dismissConsent}
            onRequestCallback={handleRequestCallback}
            onDesktopContactCard={handleDesktopContactCard}
            onSendText={handleSendText}
            onSendAudio={handleSendAudio}
            onMicStateChange={session.setMicState}
            onMicPermissionDenied={handleMicPermissionDenied}
          />
        </div>
      )}

      {!session.isOpen && <ChatLauncher onOpen={session.open} />}
    </div>
  );
}
