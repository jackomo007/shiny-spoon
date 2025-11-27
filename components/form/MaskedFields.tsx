"use client";

import * as React from "react";
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
  type RegisterOptions,
} from "react-hook-form";

import { toDisplayUS, toRawNeutral } from "@/utils/numberMask";

type BaseInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "name" | "ref"
>;

export interface MoneyInputStandaloneProps extends BaseInputProps {
  valueRaw: string;
  onChangeRaw: (value: string) => void;
  maxDecimals?: number;
}

export function MoneyInputStandalone({
  valueRaw,
  onChangeRaw,
  maxDecimals = 8,
  ...inputProps
}: MoneyInputStandaloneProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextRaw = toRawNeutral(e.target.value ?? "", maxDecimals);
    onChangeRaw(nextRaw);
  };

  const displayValue =
    valueRaw === "" ||
    valueRaw === "." ||
    valueRaw.endsWith(".") ||
    /^\d+\.$/.test(valueRaw)
      ? valueRaw
      : toDisplayUS(valueRaw, maxDecimals);

  return (
    <input
      {...inputProps}
      value={displayValue}
      onChange={handleChange}
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
    />
  );
}

export interface MoneyFieldProps<TFieldValues extends FieldValues>
  extends BaseInputProps {
  name: Path<TFieldValues>;
  control: Control<TFieldValues>;
  rules?: RegisterOptions<TFieldValues, Path<TFieldValues>>;
  decimalPlaces?: number;
}

export function MoneyField<TFieldValues extends FieldValues>({
  name,
  control,
  rules,
  decimalPlaces = 2,
  ...inputProps
}: MoneyFieldProps<TFieldValues>) {
  const maxDecimals = decimalPlaces;

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field }) => (
        <MoneyInputStandalone
          valueRaw={(field.value as string) ?? ""}
          onChangeRaw={field.onChange}
          maxDecimals={maxDecimals}
          {...inputProps}
        />
      )}
    />
  );
}

export interface DecimalFieldProps<TFieldValues extends FieldValues>
  extends BaseInputProps {
  name: Path<TFieldValues>;
  control: Control<TFieldValues>;
  rules?: RegisterOptions<TFieldValues, Path<TFieldValues>>;
  maxDecimals?: number;
}

export function DecimalField<TFieldValues extends FieldValues>({
  name,
  control,
  rules,
  maxDecimals = 4,
  ...inputProps
}: DecimalFieldProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field }) => (
        <MoneyInputStandalone
          valueRaw={(field.value as string) ?? ""}
          onChangeRaw={field.onChange}
          maxDecimals={maxDecimals}
          {...inputProps}
        />
      )}
    />
  );
}
