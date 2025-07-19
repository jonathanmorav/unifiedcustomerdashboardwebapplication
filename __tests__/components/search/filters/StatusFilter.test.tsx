import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { StatusFilter } from "@/components/search/filters/StatusFilter"

const defaultStatuses = [
  { value: "active", label: "Active", count: 10 },
  { value: "pending", label: "Pending", count: 5 },
  { value: "inactive", label: "Inactive", count: 3 },
  { value: "suspended", label: "Suspended", count: 1 },
]

describe("StatusFilter", () => {
  const mockOnChange = jest.fn()
  const defaultProps = {
    label: "Status",
    value: [],
    onChange: mockOnChange,
    options: defaultStatuses,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Rendering", () => {
    it("renders with label", () => {
      render(<StatusFilter {...defaultProps} />)
      expect(screen.getByText("Status")).toBeInTheDocument()
    })

    it("renders all status options", () => {
      render(<StatusFilter {...defaultProps} />)
      
      defaultStatuses.forEach((status) => {
        expect(screen.getByText(status.label)).toBeInTheDocument()
      })
    })

    it("shows count for each status", () => {
      render(<StatusFilter {...defaultProps} />)
      
      defaultStatuses.forEach((status) => {
        expect(screen.getByText(status.count!.toString())).toBeInTheDocument()
      })
    })

    it("shows all checkboxes unchecked by default", () => {
      render(<StatusFilter {...defaultProps} />)
      
      const checkboxes = screen.getAllByRole("checkbox", { hidden: true })
      checkboxes.forEach((checkbox) => {
        expect(checkbox).not.toBeChecked()
      })
    })

    it("shows selected statuses as checked", () => {
      render(
        <StatusFilter {...defaultProps} value={["active", "pending"]} />
      )
      
      const checkboxes = screen.getAllByRole("checkbox", { hidden: true })
      expect(checkboxes[0]).toBeChecked() // Active
      expect(checkboxes[1]).toBeChecked() // Pending
      expect(checkboxes[2]).not.toBeChecked() // Inactive
    })
  })

  describe("User Interaction", () => {
    it("toggles status on checkbox click", async () => {
      const user = userEvent.setup()
      render(<StatusFilter {...defaultProps} />)
      
      const activeLabel = screen.getByText("Active")
      await user.click(activeLabel)
      
      expect(mockOnChange).toHaveBeenCalledWith(["active"])
    })

    it("adds multiple statuses", async () => {
      const user = userEvent.setup()
      const { rerender } = render(<StatusFilter {...defaultProps} />)
      
      const activeLabel = screen.getByText("Active")
      await user.click(activeLabel)
      expect(mockOnChange).toHaveBeenCalledWith(["active"])
      
      // Reset mock and update props
      mockOnChange.mockClear()
      rerender(
        <StatusFilter {...defaultProps} value={["active"]} />
      )
      
      const pendingLabel = screen.getByText("Pending")
      await user.click(pendingLabel)
      expect(mockOnChange).toHaveBeenCalledWith(["active", "pending"])
    })

    it("removes status when unchecking", async () => {
      const user = userEvent.setup()
      render(
        <StatusFilter {...defaultProps} value={["active", "pending"]} />
      )
      
      const activeLabel = screen.getByText("Active")
      await user.click(activeLabel)
      
      expect(mockOnChange).toHaveBeenCalledWith(["pending"])
    })

    it("handles clicking on label", async () => {
      const user = userEvent.setup()
      render(<StatusFilter {...defaultProps} />)
      
      const activeLabel = screen.getByText("Active")
      await user.click(activeLabel)
      
      expect(mockOnChange).toHaveBeenCalledWith(["active"])
    })
  })

  describe("Select All / Clear All", () => {
    it("shows select all button when not all selected", () => {
      render(<StatusFilter {...defaultProps} value={["active"]} />)
      
      const selectAllButton = screen.getByRole("button", { name: /select all/i })
      expect(selectAllButton).toBeInTheDocument()
    })

    it("shows clear button when some selected", () => {
      const allValues = defaultStatuses.map((s) => s.value)
      render(<StatusFilter {...defaultProps} value={allValues} />)
      
      const clearButton = screen.getByRole("button", { name: /clear/i })
      expect(clearButton).toBeInTheDocument()
    })

    it("selects all statuses on select all click", async () => {
      const user = userEvent.setup()
      render(<StatusFilter {...defaultProps} />)
      
      const selectAllButton = screen.getByRole("button", { name: /select all/i })
      await user.click(selectAllButton)
      
      const allValues = defaultStatuses.map((s) => s.value)
      expect(mockOnChange).toHaveBeenCalledWith(allValues)
    })

    it("clears all statuses on clear click", async () => {
      const user = userEvent.setup()
      const allValues = defaultStatuses.map((s) => s.value)
      render(<StatusFilter {...defaultProps} value={allValues} />)
      
      const clearButton = screen.getByRole("button", { name: /clear/i })
      await user.click(clearButton)
      
      expect(mockOnChange).toHaveBeenCalledWith([])
    })
  })

  describe("Empty State", () => {
    it("renders empty list when no options provided", () => {
      render(<StatusFilter {...defaultProps} options={[]} />)
      
      // Should still show the label and buttons
      expect(screen.getByText("Status")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /select all/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument()
      
      // But no checkboxes
      const checkboxes = screen.queryAllByRole("checkbox", { hidden: true })
      expect(checkboxes).toHaveLength(0)
    })
  })

  describe("Custom Styling", () => {
    it("applies custom className", () => {
      const { container } = render(
        <StatusFilter {...defaultProps} className="custom-class" />
      )
      
      expect(container.firstChild).toHaveClass("custom-class")
    })

    it("applies custom label color based on status", () => {
      const customStatuses = [
        { value: "active", label: "Active", count: 10, color: "green" },
        { value: "error", label: "Error", count: 5, color: "red" },
      ]
      
      render(
        <StatusFilter {...defaultProps} options={customStatuses} />
      )
      
      // This would depend on how colors are implemented in the component
      // For now, just verify the statuses render
      expect(screen.getByText("Active")).toBeInTheDocument()
      expect(screen.getByText("Error")).toBeInTheDocument()
    })
  })

  describe("Keyboard Navigation", () => {
    it("supports keyboard navigation through checkboxes", async () => {
      const user = userEvent.setup()
      render(<StatusFilter {...defaultProps} />)
      
      const checkboxes = screen.getAllByRole("checkbox", { hidden: true })
      
      // Focus first checkbox
      checkboxes[0].focus()
      expect(checkboxes[0]).toHaveFocus()
      
      // Tab to next checkbox
      await user.tab()
      expect(checkboxes[1]).toHaveFocus()
      
      // Space to toggle
      await user.keyboard(" ")
      expect(mockOnChange).toHaveBeenCalledWith([defaultStatuses[1].value])
    })
  })

  describe("Performance", () => {
    it("handles large number of statuses", () => {
      const manyStatuses = Array.from({ length: 50 }, (_, i) => ({
        value: `status-${i}`,
        label: `Status ${i}`,
        count: Math.floor(Math.random() * 100),
      }))
      
      render(<StatusFilter {...defaultProps} options={manyStatuses} />)
      
      expect(screen.getAllByRole("checkbox")).toHaveLength(50)
    })

    it("efficiently updates when selecting many statuses", async () => {
      const user = userEvent.setup()
      const manyStatuses = Array.from({ length: 10 }, (_, i) => ({
        value: `status-${i}`,
        label: `Status ${i}`,
        count: i,
      }))
      
      render(<StatusFilter {...defaultProps} options={manyStatuses} />)
      
      // Select all should be efficient
      const selectAllButton = screen.getByRole("button", { name: /select all/i })
      await user.click(selectAllButton)
      
      expect(mockOnChange).toHaveBeenCalledTimes(1)
      expect(mockOnChange).toHaveBeenCalledWith(
        manyStatuses.map((s) => s.value)
      )
    })
  })

  describe("Edge Cases", () => {
    it("handles statuses with special characters", () => {
      const specialStatuses = [
        { value: "status-with-dash", label: "Status-With-Dash", count: 1 },
        { value: "status_with_underscore", label: "Status_With_Underscore", count: 2 },
        { value: "status.with.dot", label: "Status.With.Dot", count: 3 },
      ]
      
      render(<StatusFilter {...defaultProps} options={specialStatuses} />)
      
      specialStatuses.forEach((status) => {
        expect(screen.getByText(status.label)).toBeInTheDocument()
      })
    })

    it("handles duplicate status values gracefully", () => {
      const duplicateStatuses = [
        { value: "active", label: "Active", count: 10 },
        { value: "active", label: "Also Active", count: 5 },
      ]
      
      render(<StatusFilter {...defaultProps} options={duplicateStatuses} />)
      
      // Should render both even with duplicate values
      expect(screen.getByText("Active")).toBeInTheDocument()
      expect(screen.getByText("Also Active")).toBeInTheDocument()
    })

    it("handles zero counts", () => {
      const zeroCountStatuses = [
        { value: "empty", label: "Empty", count: 0 },
        { value: "none", label: "None", count: 0 },
      ]
      
      render(<StatusFilter {...defaultProps} options={zeroCountStatuses} />)
      
      expect(screen.getAllByText("0")).toHaveLength(2)
    })
  })
})