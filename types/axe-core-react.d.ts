declare module "@axe-core/react" {
  type AxeResults = unknown
  type AxeCore = (element: Element | Document) => Promise<AxeResults>
  const axe: AxeCore
  export default axe
}
