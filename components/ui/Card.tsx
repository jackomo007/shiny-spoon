import React from "react";

type Props = React.HTMLAttributes<HTMLDivElement> & { className?: string };

export default function Card({ className = "", ...props }: Props) {
  return (
    <div
      {...props}
      className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}
    />
  );
}
