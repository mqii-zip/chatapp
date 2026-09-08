'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { API, api } from '../../lib/api';

type User = { id: string; username: string; displayName: string; avatarUrl?: string | null; lastSeen?: string };
type Conv = { id: string; members: { user: User }[]; messages: { content: string; createdAt: string }[] };
type Msg = { id: string; conversationId: string; senderId: string; content: string; createdAt: string; sender: User };

type TypingEvent = { conversationId: string; userId: string };

export default function Chat() {
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [active, setActive] = useState<Conv | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.replace('/login');
  }

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try { setMe(JSON.parse(storedUser)); } catch { localStorage.removeItem('user'); }
    }

    api('/users/me').then(setMe).catch(logout);
    api('/chat/conversations')
      .then(setConvs)
      .catch(() => setError('Não foi possível carregar suas conversas.'));

    const socket = io(API, { autoConnect: false, auth: { token } });
    socketRef.current = socket;

    socket.on('connect_error', () => setError('Não foi possível conectar ao servidor em tempo real.'));
    socket.on('message:new', (message: Msg) => {
      setMsgs((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setConvs((current) => current.map((conv) => conv.id === message.conversationId
        ? { ...conv, messages: [{ content: message.content, createdAt: message.createdAt }] }
        : conv));
    });
    socket.on('typing:start', ({ conversationId, userId }: TypingEvent) => {
      if (activeIdRef.current === conversationId) setTypingUserId(userId);
    });
    socket.on('typing:stop', ({ conversationId, userId }: TypingEvent) => {
      if (activeIdRef.current === conversationId) {
        setTypingUserId((current) => current === userId ? null : current);
      }
    });
    socket.connect();

    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      socket.disconnect();
      socket.removeAllListeners();
      socketRef.current = null;
    };
  }, [router]);

  useEffect(() => {
    activeIdRef.current = active?.id ?? null;
    setTypingUserId(null);
    if (!active) return;

    setMsgs([]);
    setError('');
    api(`/chat/conversations/${active.id}/messages`)
      .then(setMsgs)
      .catch(() => setError('Não foi possível carregar as mensagens.'));
    socketRef.current?.emit('join_conversation', active.id);
  }, [active]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const normalized = query.replace(/^@/, '').trim();
      if (!normalized) return setResults([]);
      api(`/users/search?q=${encodeURIComponent(normalized)}`).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  async function openUser(user: User) {
    try {
      setError('');
      const conversation = await api(`/chat/conversations/private/${user.id}`, { method: 'POST' });
      setConvs((current) => current.some((item) => item.id === conversation.id) ? current : [conversation, ...current]);
      setActive(conversation);
      setQuery('');
      setResults([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível abrir a conversa.');
    }
  }

  function handleTyping(value: string) {
    setText(value);
    if (!active) return;
    socketRef.current?.emit('typing:start', { conversationId: active.id });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit('typing:stop', { conversationId: active.id });
    }, 700);
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!active || !text.trim()) return;
    try {
      setError('');
      const message = await api(`/chat/conversations/${active.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      });
      setMsgs((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setConvs((current) => current.map((conv) => conv.id === active.id
        ? { ...conv, messages: [{ content: message.content, createdAt: message.createdAt }] }
        : conv));
      setText('');
      socketRef.current?.emit('typing:stop', { conversationId: active.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar a mensagem.');
    }
  }

  function other(conversation: Conv) {
    return conversation.members.find((member) => member.user.id !== me?.id)?.user ?? conversation.members[0]?.user;
  }

  return (
    <main className="chat">
      <aside className="sidebar">
        <div className="sidebarTop">
          <div><h2>Chat</h2>{me && <div className="muted">@{me.username}</div>}</div>
          <button className="ghostButton" onClick={logout}>Sair</button>
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar @username" />
        {results.length > 0 && <div className="searchResults">
          {results.map((user) => <button className="conversation" key={user.id} onClick={() => openUser(user)}>
            <div className="avatar">{user.displayName[0]?.toUpperCase() ?? '?'}</div>
            <div><b>{user.displayName}</b><div className="muted">@{user.username}</div></div>
          </button>)}
        </div>}
        <hr />
        {convs.map((conversation) => {
          const user = other(conversation);
          return <button className={`conversation ${active?.id === conversation.id ? 'active' : ''}`} key={conversation.id} onClick={() => setActive(conversation)}>
            <div className="avatar">{user?.displayName?.[0]?.toUpperCase() ?? '?'}</div>
            <div className="conversationText"><b>{user?.displayName}</b><div className="muted">@{user?.username}</div>{conversation.messages[0] && <small>{conversation.messages[0].content}</small>}</div>
          </button>;
        })}
      </aside>
      <section className="main">
        {active ? <>
          <header className="header">
            <div><b>{other(active)?.displayName}</b><div className="muted">@{other(active)?.username}</div></div>
            {typingUserId && <span className="muted">digitando...</span>}
          </header>
          <div className="messages">
            {msgs.map((message) => <div key={message.id} className={`msg ${message.senderId === me?.id ? 'me' : ''}`}>
              <div>{message.content}</div>
              <small>{new Date(message.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>
            </div>)}
          </div>
          <form className="composer" onSubmit={send}>
            <input value={text} onChange={(event) => handleTyping(event.target.value)} placeholder="Digite uma mensagem..." maxLength={4000} />
            <button className="btn" type="submit">Enviar</button>
          </form>
        </> : <div className="empty">Selecione uma conversa ou procure alguém.</div>}
        {error && <div className="errorBar">{error}</div>}
      </section>
    </main>
  );
}
