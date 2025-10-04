'use client'

import React from 'react';

type Props = {
  children?: React.ReactNode;
  className?: string;
  message?: string;
};

export default function ConfirmButton({ children, className, message = 'Confirmer la suppression ?' }: Props) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        const ok = window.confirm(message);
        if (!ok) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        // otherwise let the submit proceed
      }}
    >
      {children}
    </button>
  );
}
