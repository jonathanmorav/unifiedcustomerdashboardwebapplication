// Type declarations for other missing modules
declare module '@axe-core/react' {
  export function configureAxe(config: any): void
  export default function axe(
    react: any,
    reactDOM: any,
    timeout?: number
  ): Promise<void>
}

declare module 'embla-carousel-react' {
  export type UseEmblaCarouselType = [any, any]
  export default function useEmblaCarousel(
    options?: any,
    plugins?: any[]
  ): UseEmblaCarouselType
}

declare module 'vaul' {
  export const Drawer: any
}

declare module 'react-hook-form' {
  export function useForm(options?: any): any
  export function useFormContext(): any
  export const FormProvider: any
  export const Controller: any
  export type FieldPath<T> = any
  export type FieldValues = any
  export type ControllerProps<T extends FieldValues = FieldValues> = any
  export type UseFormReturn<T extends FieldValues = FieldValues> = any
}

declare module 'input-otp' {
  export const OTPInput: any
  export const OTPInputContext: any
  export const REGEXP_ONLY_DIGITS_AND_CHARS: any
}

declare module 'react-resizable-panels' {
  export const Panel: any
  export const PanelGroup: any
  export const PanelResizeHandle: any
}

declare module '@/hooks/use-mobile' {
  export function useIsMobile(): boolean
}

declare module '@/hooks/use-toast' {
  export function useToast(): any
  export function toast(options: any): void
}

declare module '@/components/ui/toast' {
  export const Toast: any
  export const ToastAction: any
  export const ToastClose: any
  export const ToastDescription: any
  export const ToastProvider: any
  export const ToastTitle: any
  export const ToastViewport: any
  export type ToastProps = any
  export type ToastActionElement = any
}

declare module '@/components/ui/toggle' {
  export const Toggle: any
}

declare module '@/components/ui/slider' {
  export const Slider: any
}

declare module '@/components/ui/textarea' {
  export const Textarea: any
}

declare module '@storybook/react' {
  export const storiesOf: any
  export type Meta = any
  export type StoryObj<T> = any
}