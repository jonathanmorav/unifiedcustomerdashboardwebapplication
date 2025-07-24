import type { Meta, StoryObj } from "@storybook/react"
import { Pagination } from "@/components/ui/pagination"

const meta: Meta<typeof Pagination> = {
  title: "UI/Pagination",
  component: Pagination,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    currentPage: {
      control: { type: "number", min: 1 },
      description: "Current active page",
    },
    totalPages: {
      control: { type: "number", min: 1 },
      description: "Total number of pages",
    },
    onChange: {
      action: "page changed",
      description: "Callback when page changes",
    },
    showFirstLast: {
      control: "boolean",
      description: "Show first and last page buttons",
    },
    maxVisiblePages: {
      control: { type: "number", min: 1 },
      description: "Maximum number of page buttons to show (performance cap)",
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const SinglePage: Story = {
  args: {
    currentPage: 1,
    totalPages: 1,
    onChange: (page: number) => console.log("Page changed to:", page),
  },
  parameters: {
    docs: {
      description: {
        story: "When there is only one page, the pagination component is hidden.",
      },
    },
  },
}

export const FivePages: Story = {
  args: {
    currentPage: 3,
    totalPages: 5,
    onChange: (page: number) => console.log("Page changed to:", page),
  },
  parameters: {
    docs: {
      description: {
        story: "With 5 pages, all page numbers are shown without ellipses.",
      },
    },
  },
}

export const TenPages: Story = {
  args: {
    currentPage: 5,
    totalPages: 10,
    onChange: (page: number) => console.log("Page changed to:", page),
  },
  parameters: {
    docs: {
      description: {
        story: "With 10 pages, all page numbers are shown without ellipses.",
      },
    },
  },
}

export const OneHundredPages: Story = {
  args: {
    currentPage: 50,
    totalPages: 100,
    onChange: (page: number) => console.log("Page changed to:", page),
  },
  parameters: {
    docs: {
      description: {
        story: "With 100 pages, ellipses are used to show only a subset of pages for performance.",
      },
    },
  },
}

export const FirstPage: Story = {
  args: {
    currentPage: 1,
    totalPages: 50,
    onChange: (page: number) => console.log("Page changed to:", page),
  },
  parameters: {
    docs: {
      description: {
        story: "When on the first page of many, more pages are shown toward the end.",
      },
    },
  },
}

export const LastPage: Story = {
  args: {
    currentPage: 50,
    totalPages: 50,
    onChange: (page: number) => console.log("Page changed to:", page),
  },
  parameters: {
    docs: {
      description: {
        story: "When on the last page of many, more pages are shown toward the beginning.",
      },
    },
  },
}

export const WithoutFirstLast: Story = {
  args: {
    currentPage: 25,
    totalPages: 100,
    onChange: (page: number) => console.log("Page changed to:", page),
    showFirstLast: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Pagination without first and last page navigation buttons.",
      },
    },
  },
}

export const PerformanceCap: Story = {
  args: {
    currentPage: 500,
    totalPages: 1000,
    onChange: (page: number) => console.log("Page changed to:", page),
    maxVisiblePages: 20,
  },
  parameters: {
    docs: {
      description: {
        story: "With a lower performance cap, fewer pages are shown even with many total pages.",
      },
    },
  },
}
