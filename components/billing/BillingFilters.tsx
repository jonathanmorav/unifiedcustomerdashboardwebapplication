'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Filter,
  Calendar as CalendarIcon,
  Search,
  X,
  ChevronDown,
  DollarSign,
} from 'lucide-react';
import { format } from 'date-fns';

export interface BillingFilterValues {
  dateRange: {
    start: Date | null;
    end: Date | null;
    preset?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  };
  status: string[];
  amountRange: {
    min: number | null;
    max: number | null;
  };
  direction: 'all' | 'credit' | 'debit';
  searchQuery: string;
}

interface BillingFiltersProps {
  filters: BillingFilterValues;
  onFiltersChange: (filters: BillingFilterValues) => void;
  onClearFilters: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const datePresets = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'This Quarter', value: 'quarter' },
  { label: 'This Year', value: 'year' },
  { label: 'Custom Range', value: 'custom' },
];

const statusOptions = [
  { label: 'Pending', value: 'pending', color: 'bg-yellow-100' },
  { label: 'Processing', value: 'processing', color: 'bg-blue-100' },
  { label: 'Completed', value: 'completed', color: 'bg-green-100' },
  { label: 'Failed', value: 'failed', color: 'bg-red-100' },
  { label: 'Cancelled', value: 'cancelled', color: 'bg-gray-100' },
  { label: 'Returned', value: 'returned', color: 'bg-orange-100' },
];

export const BillingFilters: React.FC<BillingFiltersProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDateRange, setTempDateRange] = useState(filters.dateRange);

  const handleDatePresetChange = (preset: string) => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (preset) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        start = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        start = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'quarter':
        start = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case 'year':
        start = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      case 'custom':
        setShowDatePicker(true);
        return;
      default:
        return;
    }

    onFiltersChange({
      ...filters,
      dateRange: { start, end, preset: preset as any },
    });
  };

  const handleStatusChange = (status: string) => {
    const newStatuses = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    
    onFiltersChange({
      ...filters,
      status: newStatuses,
    });
  };

  const handleAmountChange = (type: 'min' | 'max', value: string) => {
    const amount = value ? parseFloat(value) : null;
    onFiltersChange({
      ...filters,
      amountRange: {
        ...filters.amountRange,
        [type]: amount,
      },
    });
  };

  const activeFilterCount = [
    filters.dateRange.start ? 1 : 0,
    filters.status.length > 0 ? 1 : 0,
    filters.amountRange.min || filters.amountRange.max ? 1 : 0,
    filters.direction !== 'all' ? 1 : 0,
    filters.searchQuery ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <Card className="shadow-cakewalk-medium">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-cakewalk-primary text-white text-xs px-2 py-1 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearFilters}>
                Clear All
              </Button>
            )}
            {onToggleCollapse && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleCollapse}
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    isCollapsed ? 'rotate-180' : ''
                  }`}
                />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      {!isCollapsed && (
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range Filter */}
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select
                value={filters.dateRange.preset || 'custom'}
                onValueChange={handleDatePresetChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  {datePresets.map(preset => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.dateRange.start && filters.dateRange.end && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {format(filters.dateRange.start, 'MMM d, yyyy')} -{' '}
                  {format(filters.dateRange.end, 'MMM d, yyyy')}
                </p>
              )}
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {filters.status.length === 0
                      ? 'All statuses'
                      : `${filters.status.length} selected`}
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56">
                  <div className="space-y-2">
                    {statusOptions.map(status => (
                      <div key={status.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={status.value}
                          checked={filters.status.includes(status.value)}
                          onCheckedChange={() => handleStatusChange(status.value)}
                        />
                        <label
                          htmlFor={status.value}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                        >
                          <span className={`w-3 h-3 rounded-full ${status.color}`} />
                          {status.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Amount Range Filter */}
            <div className="space-y-2">
              <Label>Amount Range</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.amountRange.min || ''}
                    onChange={(e) => handleAmountChange('min', e.target.value)}
                    className="pl-8"
                  />
                </div>
                <span className="text-gray-500">-</span>
                <div className="relative flex-1">
                  <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.amountRange.max || ''}
                    onChange={(e) => handleAmountChange('max', e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>

            {/* Direction Filter */}
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select
                value={filters.direction}
                onValueChange={(value: any) =>
                  onFiltersChange({ ...filters, direction: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Transactions</SelectItem>
                  <SelectItem value="credit">Credits Only</SelectItem>
                  <SelectItem value="debit">Debits Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-2 lg:col-span-4">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by ID, customer name, company, or reference..."
                  value={filters.searchQuery}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, searchQuery: e.target.value })
                  }
                  className="pl-10"
                />
                {filters.searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1"
                    onClick={() =>
                      onFiltersChange({ ...filters, searchQuery: '' })
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {activeFilterCount > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {filters.dateRange.start && (
                <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                  <CalendarIcon className="h-3 w-3" />
                  {format(filters.dateRange.start, 'MMM d')} -{' '}
                  {format(filters.dateRange.end!, 'MMM d, yyyy')}
                  <button
                    onClick={() =>
                      onFiltersChange({
                        ...filters,
                        dateRange: { start: null, end: null },
                      })
                    }
                    className="ml-1 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {filters.status.map(status => (
                <div
                  key={status}
                  className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                >
                  {status}
                  <button
                    onClick={() => handleStatusChange(status)}
                    className="ml-1 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};