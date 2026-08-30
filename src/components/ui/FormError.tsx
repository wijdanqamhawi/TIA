import { cn } from "@/lib/utils/cn";

export type FormErrorProps = {
  message?: string | null;
  className?: string;
  id?: string;
};

export function FormError({ message, className, id }: FormErrorProps) {
  if (!message) return null;

  return (
    <p id={id} role="alert" className={cn("text-sm text-red-700", className)}>
      {message}
    </p>
  );
}
