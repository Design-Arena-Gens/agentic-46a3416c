'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface ChatMessageProps {
  role: 'user' | 'assistant';
  children: ReactNode;
}

export function ChatMessage({ role, children }: ChatMessageProps) {
  return (
    <div className={clsx('message', role)}>
      <div className="message-bubble">{children}</div>
    </div>
  );
}
