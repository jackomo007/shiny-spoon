"use client";

import * as React from "react";

type TableProps = React.TableHTMLAttributes<HTMLTableElement> & {
  containerClassName?: string;
};

export function Table({
  children,
  className,
  containerClassName,
  ...rest
}: TableProps) {
  return (
    <div className={["overflow-x-auto", containerClassName].filter(Boolean).join(" ")}>
      <table className={["w-full text-sm", className].filter(Boolean).join(" ")} {...rest}>
        {children}
      </table>
    </div>
  );
}

type ThProps = React.ThHTMLAttributes<HTMLTableCellElement>;
export function Th({ children, className, ...rest }: ThProps) {
  return (
    <th
      className={["text-left text-gray-500 font-medium pb-2", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </th>
  );
}

type TdProps = React.TdHTMLAttributes<HTMLTableCellElement>;
export function Td({ children, className, ...rest }: TdProps) {
  return (
    <td
      className={["py-3 border-top border-gray-100", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </td>
  );
}

type TrProps = React.HTMLAttributes<HTMLTableRowElement>;
export function Tr({ children, className, ...rest }: TrProps) {
  return (
    <tr
      className={["[&>td]:pr-4 last:[&>td]:pr-0", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </tr>
  );
}
