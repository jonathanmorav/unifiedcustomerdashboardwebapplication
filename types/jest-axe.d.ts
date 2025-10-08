declare module "jest-axe" {
  export function axe(element: Element | Document): Promise<any>
  export function toHaveNoViolations(): any
  export function configureAxe(options?: any): void
}

declare namespace jest {
  interface Matchers<R> {
    toHaveNoViolations(): R
  }
}