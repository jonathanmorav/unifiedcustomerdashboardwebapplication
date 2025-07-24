import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import { Pagination } from "@/components/ui/pagination"

describe("Pagination Component", () => {
  const mockOnChange = jest.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  describe("Single Page", () => {
    it("should not render when totalPages is 1", () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={1} onChange={mockOnChange} />
      )

      expect(container.firstChild).toBeNull()
    })

    it("should not render when totalPages is 0", () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={0} onChange={mockOnChange} />
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe("Five Pages", () => {
    it("should render all 5 page numbers without ellipses", () => {
      render(<Pagination currentPage={3} totalPages={5} onChange={mockOnChange} />)

      // Check that all 5 page numbers are present
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByLabelText(`Go to page ${i}`)).toBeInTheDocument()
      }

      // Check that there are no ellipses
      expect(screen.queryByText("...")).not.toBeInTheDocument()

      // Check that page 3 is active
      expect(screen.getByLabelText("Go to page 3")).toHaveAttribute("aria-current", "page")
    })

    it("should handle navigation correctly", () => {
      render(<Pagination currentPage={3} totalPages={5} onChange={mockOnChange} />)

      // Click on page 4
      fireEvent.click(screen.getByLabelText("Go to page 4"))
      expect(mockOnChange).toHaveBeenCalledWith(4)

      // Click on previous button
      fireEvent.click(screen.getByLabelText("Go to previous page"))
      expect(mockOnChange).toHaveBeenCalledWith(2)

      // Click on next button
      fireEvent.click(screen.getByLabelText("Go to next page"))
      expect(mockOnChange).toHaveBeenCalledWith(4)
    })
  })

  describe("Ten Pages", () => {
    it("should render all 10 page numbers without ellipses", () => {
      render(<Pagination currentPage={5} totalPages={10} onChange={mockOnChange} />)

      // Check that all 10 page numbers are present
      for (let i = 1; i <= 10; i++) {
        expect(screen.getByLabelText(`Go to page ${i}`)).toBeInTheDocument()
      }

      // Check that there are no ellipses
      expect(screen.queryByText("...")).not.toBeInTheDocument()

      // Check that page 5 is active
      expect(screen.getByLabelText("Go to page 5")).toHaveAttribute("aria-current", "page")
    })

    it("should disable navigation buttons appropriately at boundaries", () => {
      const { rerender } = render(
        <Pagination currentPage={1} totalPages={10} onChange={mockOnChange} />
      )

      // On first page, previous and first should be disabled
      expect(screen.getByLabelText("Go to previous page")).toBeDisabled()
      expect(screen.getByLabelText("Go to first page")).toBeDisabled()
      expect(screen.getByLabelText("Go to next page")).not.toBeDisabled()
      expect(screen.getByLabelText("Go to last page")).not.toBeDisabled()

      // On last page, next and last should be disabled
      rerender(<Pagination currentPage={10} totalPages={10} onChange={mockOnChange} />)

      expect(screen.getByLabelText("Go to previous page")).not.toBeDisabled()
      expect(screen.getByLabelText("Go to first page")).not.toBeDisabled()
      expect(screen.getByLabelText("Go to next page")).toBeDisabled()
      expect(screen.getByLabelText("Go to last page")).toBeDisabled()
    })
  })

  describe("One Hundred Pages", () => {
    it("should render with ellipses and limited page numbers", () => {
      render(<Pagination currentPage={50} totalPages={100} onChange={mockOnChange} />)

      // Should have ellipses
      expect(screen.getAllByText("...")).toHaveLength(2)

      // Should have first and last page
      expect(screen.getByLabelText("Go to page 1")).toBeInTheDocument()
      expect(screen.getByLabelText("Go to page 100")).toBeInTheDocument()

      // Should have current page
      expect(screen.getByLabelText("Go to page 50")).toBeInTheDocument()
      expect(screen.getByLabelText("Go to page 50")).toHaveAttribute("aria-current", "page")

      // Should not render all 100 pages
      const pageButtons = screen
        .getAllByRole("button")
        .filter((button) => button.getAttribute("aria-label")?.startsWith("Go to page "))
      expect(pageButtons.length).toBeLessThan(100)
    })

    it("should adjust page display when near the beginning", () => {
      render(<Pagination currentPage={3} totalPages={100} onChange={mockOnChange} />)

      // Should show more pages at the beginning
      expect(screen.getByLabelText("Go to page 1")).toBeInTheDocument()
      expect(screen.getByLabelText("Go to page 2")).toBeInTheDocument()
      expect(screen.getByLabelText("Go to page 3")).toBeInTheDocument()
      expect(screen.getByLabelText("Go to page 4")).toBeInTheDocument()
      expect(screen.getByLabelText("Go to page 5")).toBeInTheDocument()

      // Should have ellipsis and last page
      expect(screen.getByText("...")).toBeInTheDocument()
      expect(screen.getByLabelText("Go to page 100")).toBeInTheDocument()
    })

    it("should adjust page display when near the end", () => {
      render(<Pagination currentPage={98} totalPages={100} onChange={mockOnChange} />)

      // Should show more pages at the end
      expect(screen.getByLabelText("Go to page 96")).toBeInTheDocument()
      expect(screen.getByLabelText("Go to page 97")).toBeInTheDocument()
      expect(screen.getByLabelText("Go to page 98")).toBeInTheDocument()
      expect(screen.getByLabelText("Go to page 99")).toBeInTheDocument()
      expect(screen.getByLabelText("Go to page 100")).toBeInTheDocument()

      // Should have first page and ellipsis
      expect(screen.getByLabelText("Go to page 1")).toBeInTheDocument()
      expect(screen.getByText("...")).toBeInTheDocument()
    })
  })

  describe("Navigation Actions", () => {
    it("should handle first and last page navigation", () => {
      render(<Pagination currentPage={50} totalPages={100} onChange={mockOnChange} />)

      // Click first page button
      fireEvent.click(screen.getByLabelText("Go to first page"))
      expect(mockOnChange).toHaveBeenCalledWith(1)

      // Click last page button
      fireEvent.click(screen.getByLabelText("Go to last page"))
      expect(mockOnChange).toHaveBeenCalledWith(100)
    })

    it("should not call onChange when clicking current page", () => {
      render(<Pagination currentPage={5} totalPages={10} onChange={mockOnChange} />)

      // Click current page
      fireEvent.click(screen.getByLabelText("Go to page 5"))
      expect(mockOnChange).not.toHaveBeenCalled()
    })

    it("should not call onChange with invalid page numbers", () => {
      const { rerender } = render(
        <Pagination currentPage={1} totalPages={10} onChange={mockOnChange} />
      )

      // Try to go to page 0 (should not happen through UI but test the logic)
      fireEvent.click(screen.getByLabelText("Go to previous page"))
      expect(mockOnChange).not.toHaveBeenCalledWith(0)

      rerender(<Pagination currentPage={10} totalPages={10} onChange={mockOnChange} />)

      // Try to go beyond last page
      fireEvent.click(screen.getByLabelText("Go to next page"))
      expect(mockOnChange).not.toHaveBeenCalledWith(11)
    })
  })

  describe("Accessibility", () => {
    it("should have proper ARIA labels", () => {
      render(<Pagination currentPage={5} totalPages={10} onChange={mockOnChange} />)

      expect(screen.getByLabelText("Go to first page")).toBeInTheDocument()
      expect(screen.getByLabelText("Go to previous page")).toBeInTheDocument()
      expect(screen.getByLabelText("Go to next page")).toBeInTheDocument()
      expect(screen.getByLabelText("Go to last page")).toBeInTheDocument()
      expect(screen.getByLabelText("Go to page 5")).toHaveAttribute("aria-current", "page")
    })

    it("should hide ellipses from screen readers", () => {
      render(<Pagination currentPage={50} totalPages={100} onChange={mockOnChange} />)

      const ellipses = screen.getAllByText("...")
      ellipses.forEach((ellipsis) => {
        expect(ellipsis).toHaveAttribute("aria-hidden", "true")
      })
    })
  })

  describe("Configuration Options", () => {
    it("should respect showFirstLast prop", () => {
      render(
        <Pagination
          currentPage={50}
          totalPages={100}
          onChange={mockOnChange}
          showFirstLast={false}
        />
      )

      expect(screen.queryByLabelText("Go to first page")).not.toBeInTheDocument()
      expect(screen.queryByLabelText("Go to last page")).not.toBeInTheDocument()
      expect(screen.getByLabelText("Go to previous page")).toBeInTheDocument()
      expect(screen.getByLabelText("Go to next page")).toBeInTheDocument()
    })

    it("should respect maxVisiblePages prop", () => {
      render(
        <Pagination
          currentPage={50}
          totalPages={100}
          onChange={mockOnChange}
          maxVisiblePages={10}
        />
      )

      const pageButtons = screen
        .getAllByRole("button")
        .filter((button) => button.getAttribute("aria-label")?.startsWith("Go to page "))

      // Should have fewer page buttons due to lower max
      expect(pageButtons.length).toBeLessThanOrEqual(10)
    })

    it("should apply custom className", () => {
      const { container } = render(
        <Pagination
          currentPage={5}
          totalPages={10}
          onChange={mockOnChange}
          className="custom-pagination"
        />
      )

      expect(container.firstChild).toHaveClass("custom-pagination")
    })
  })
})

// Fix the typo in the test
describe("Pagination Component - Boundary Tests", () => {
  const mockOnChange = jest.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  it("should disable navigation buttons appropriately at boundaries", () => {
    const { rerender } = render(
      <Pagination currentPage={1} totalPages={10} onChange={mockOnChange} />
    )

    // On first page, previous and first should be disabled
    expect(screen.getByLabelText("Go to previous page")).toBeDisabled()
    expect(screen.getByLabelText("Go to first page")).toBeDisabled()
    expect(screen.getByLabelText("Go to next page")).not.toBeDisabled()
    expect(screen.getByLabelText("Go to last page")).not.toBeDisabled()

    // On last page, next and last should be disabled
    rerender(<Pagination currentPage={10} totalPages={10} onChange={mockOnChange} />)

    expect(screen.getByLabelText("Go to previous page")).not.toBeDisabled()
    expect(screen.getByLabelText("Go to first page")).not.toBeDisabled()
    expect(screen.getByLabelText("Go to next page")).toBeDisabled()
    expect(screen.getByLabelText("Go to last page")).toBeDisabled()
  })
})
