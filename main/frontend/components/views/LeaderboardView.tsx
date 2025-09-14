import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, LoadingSpinner, Alert, Button } from '../ui';

interface LeaderboardUser {
  name: string;
  login: string;
  id: number;
  level: number;
  correction_points: number;
  total_logtime: number;
  profile_url: string;
  currently_logged_in: boolean;
  current_seat: string | null;
  pool_month: string | null;
  pool_year: string | null;
  blackhole_date: string | null;
  wallet: number;
  last_project: string | null;
  image_url: string | null;
  status: 'alive' | 'frozen' | 'blackholed';
  coalition_id: number | null;
  coalition_score: number | null;
  has_evaluated: number;
  got_evaluated: number;
}

type SortBy = 'level' | 'coalition_score' | 'wallet' | 'total_logtime' | 'correction_points' | 'name' | 'login' | 'coalition' | 'status' | 'project' | 'coalition' | 'status' | 'project';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list' | 'compact';

// Project order for sorting
const PROJECT_ORDER = [
  "Libft",
  "ft_printf",
  "Born2beroot",
  "get_next_line",
  "so_long",
  "FdF",
  "fract-ol",
  "minitalk",
  "pipex",
  "push_swap",
  "Exam Rank 02",
  "Philosophers",
  "minishell",
  "Exam Rank 03",
  "NetPractice",
  "CPP Module 00",
  "CPP Module 01",
  "CPP Module 02",
  "CPP Module 03",
  "CPP Module 04",
  "miniRT",
  "cub3d",
  "Exam Rank 04",
  "CPP Module 05",
  "CPP Module 06",
  "CPP Module 07",
  "CPP Module 08",
  "CPP Module 09",
  "Inception",
  "webserv",
  "ft_irc",
  "Exam Rank 05",
  "ft_transcendence",
  "Exam Rank 06",
];

// Filter project names according to the rules:
// - If " - " (with spaces) exists, remove " - " and everything after
// - Exception: if what's after " - " is a number, keep only that number
function filterProjectName(projectName: string): string {
  if (!projectName || projectName === 'None') return projectName;
  
  const dashIndex = projectName.indexOf(' - ');
  if (dashIndex === -1) return projectName;
  
  const beforeDash = projectName.substring(0, dashIndex);
  const afterDash = projectName.substring(dashIndex + 3); // +3 to skip " - "
  
  // Check if what's after the dash is a number (possibly with other text)
  const numberMatch = afterDash.match(/^(\d+)/);
  if (numberMatch) {
    return `${beforeDash} ${numberMatch[1]}`;
  }
  
  // Otherwise, remove everything after the dash
  return beforeDash;
}

// Get project sort value
function getProjectSortValue(lastProject: string | null): number {
  if (!lastProject || lastProject === 'None') return 9999;
  
  // Extract project name from "Project Name (score)" format
  const projectMatch = lastProject.match(/^(.+)\s+\(\d+\)$/);
  let projectName = projectMatch?.[1] || lastProject;
  
  // Apply project name filtering for consistent sorting
  projectName = filterProjectName(projectName);
  
  const index = PROJECT_ORDER.indexOf(projectName);
  return index === -1 ? 9999 : index;
}

// Get coalition sort value (Corrino first, Atreides last)
function getCoalitionSortValue(coalitionId: number | null): number {
  if (coalitionId === null) return 999;
  if (coalitionId === 468) return 0; // Corrino first
  if (coalitionId === 467) return 1; // Harkonnen middle
  if (coalitionId === 471) return 2; // Atreides last
  return 999; // Unknown coalitions last
}

// Get status sort value (online > offline > frozen > blackholed)
function getStatusSortValue(user: LeaderboardUser): number {
  if (user.currently_logged_in) {
    // Online users sorted by cluster row seat
    if (user.current_seat) {
      // Extract row and seat numbers for sorting
      const seatMatch = user.current_seat.match(/(\d+)([a-z])(\d+)/i);
      if (seatMatch) {
        const row = parseInt(seatMatch[1]);
        const letter = seatMatch[2].toLowerCase();
        const seat = parseInt(seatMatch[3]);
        // Sort by row, then letter, then seat number
        return row * 1000 + letter.charCodeAt(0) * 10 + seat;
      }
      return 0; // Online with seat but unparseable
    }
    return 0; // Online without specific seat
  }
  
  if (user.status === 'alive') return 10000; // Offline
  if (user.status === 'frozen') return 20000; // Frozen
  if (user.status === 'blackholed') return 30000; // Blackholed
  return 40000; // Unknown status
}

// Format time in seconds to human readable format
function formatLogtime(seconds: number): string {
  if (seconds === 0) return '0h';
  
  const hours = Math.floor(seconds / 3600);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  }
}

// Get status badge with clear visual indicators
function getStatusBadge(status: string, currently_logged_in: boolean, current_seat: string | null) {
  if (currently_logged_in) {
    return { 
      text: current_seat ? `Seat ${current_seat}` : 'Online', 
      className: 'bg-green-500/20 text-green-400 border-green-500/30',
      dot: 'bg-green-400'
    };
  }
  
  switch (status) {
    case 'alive':
      return { 
        text: 'Active', 
        className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        dot: 'bg-blue-400'
      };
    case 'frozen':
      return { 
        text: 'Frozen', 
        className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        dot: 'bg-yellow-400'
      };
    case 'blackholed':
      return { 
        text: 'Blackholed', 
        className: 'bg-red-500/20 text-red-400 border-red-500/30',
        dot: 'bg-red-400'
      };
    default:
      return { 
        text: 'Unknown', 
        className: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
        dot: 'bg-gray-400'
      };
  }
}

// Get coalition info with colors
function getCoalitionInfo(id: number | null): { name: string; color: string; bgColor: string } {
  if (!id) return { name: 'None', color: 'text-gray-400', bgColor: 'bg-gray-500/10' };
  
  const coalitions: { [key: number]: { name: string; color: string; bgColor: string } } = {
    471: { name: '🟩', color: 'text-red-400', bgColor: 'bg-red-500/10' },
    468: { name: '🟧', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    467: { name: '🟪', color: 'text-green-400', bgColor: 'bg-green-500/10' },
  };
  
  return coalitions[id] || { name: `Coalition ${id}`, color: 'text-purple-400', bgColor: 'bg-purple-500/10' };
}

// Get rank badge styling
function getRankBadge(rank: number) {
  if (rank === 1) return { icon: '👑', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', text: 'Champion' };
  if (rank === 2) return { icon: '🥈', className: 'bg-gray-400/20 text-gray-300 border-gray-400/30', text: '2nd Place' };
  if (rank === 3) return { icon: '🥉', className: 'bg-amber-600/20 text-amber-400 border-amber-600/30', text: '3rd Place' };
  if (rank <= 10) return { icon: '⭐', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30', text: 'Top 10' };
  return null;
}

// Truncate long names by keeping only first name and last surname
function truncateName(fullName: string): string {
  if (!fullName) return fullName;
  
  // Split the name by spaces
  const nameParts = fullName.trim().split(/\s+/);
  
  // If name has 2 or fewer parts, return as is
  if (nameParts.length <= 2) {
    return fullName;
  }
  
  // If name has more than 2 parts, keep first name and last surname only
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  
  return `${firstName} ${lastName}`;
}



// Simple table row component
function UserTableRow({ user, rank }: { user: LeaderboardUser; rank: number }) {
  const coalition = getCoalitionInfo(user.coalition_id);
  
  // Parse last project
  const lastProject = user.last_project?.match(/^(.+)\s+\((\d+)\)$/);
  let projectName = lastProject?.[1] || user.last_project || 'None';
  const projectScore = lastProject?.[2] ? parseInt(lastProject[2]) : null;

  // Apply project name filtering
  if (projectName !== 'None') {
    projectName = filterProjectName(projectName);
  }

  // Status indicator
  let statusIcon = '🟡';
  let statusText = 'Active';
  if (user.currently_logged_in) {
    statusIcon = '🟢';
    statusText = user.current_seat ? `${user.current_seat}` : 'Online';
  } else if (user.status === 'frozen') {
    statusIcon = '🔵';
    statusText = 'Frozen';
  } else if (user.status === 'blackholed') {
    statusIcon = '⚫';
    statusText = 'Blackholed';
  }

  return (
    <>
      {/* Desktop Table Row */}
      <tr className={`hidden lg:table-row border-b border-border hover:bg-muted/50 transition-colors ${
        rank <= 3 ? 'bg-primary/5' : ''
      }`}>
        {/* Rank */}
        <td className="px-4 py-3 text-center">
          <div className={`font-bold text-lg ${rank <= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
            {rank === 1 && '👑'}
            {rank === 2 && '🥈'}
            {rank === 3 && '🥉'}
            {rank > 3 && `#${rank}`}
          </div>
        </td>

        {/* User */}
        <td className="px-4 py-3">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-10 h-10">
              <a
                href={`https://profile.intra.42.fr/users/${user.login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block transition-opacity hover:opacity-80"
              >
                {user.image_url ? (
                  <img
                    src={user.image_url}
                    alt={user.name}
                    className="object-cover w-10 h-10 border rounded-full cursor-pointer border-border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-10 h-10 rounded-full border border-border bg-muted flex items-center justify-center text-sm font-bold cursor-pointer ${user.image_url ? 'hidden' : ''}`}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
              </a>
            </div>
            <div className="flex-1 min-w-0">
              <a
                href={`https://profile.intra.42.fr/users/${user.login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block transition-colors hover:text-primary"
              >
                <div className="font-semibold truncate text-foreground" title={user.name}>{truncateName(user.name)}</div>
              </a>
              <a
                href={`https://profile.intra.42.fr/users/${user.login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block transition-colors hover:text-primary"
              >
                <div className="text-sm truncate text-muted-foreground">@{user.login}</div>
              </a>
            </div>
          </div>
        </td>

        {/* Level */}
        <td className="px-4 py-3 text-center">
          <div className="text-lg font-bold text-primary">{user.level.toFixed(2)}</div>
        </td>

        {/* Coalition Score */}
        <td className="px-4 py-3 text-center">
          <div className="font-semibold">{user.coalition_score?.toLocaleString() || '0'}</div>
        </td>

        {/* Coalition */}
        <td className="px-4 py-3 text-center">
          <span className={`text-sm px-2 py-1 rounded ${coalition.color}`}>
            {coalition.name}
          </span>
        </td>

        {/* Status */}
        <td className="px-4 py-3 text-center">
          <div className="flex items-center justify-center space-x-1">
            <span role="img" aria-label={statusText}>{statusIcon}</span>
            <span className="text-sm">{statusText}</span>
          </div>
        </td>

        {/* Wallet */}
        <td className="px-4 py-3 text-center">
          <div className="font-semibold">{user.wallet}</div>
        </td>

        {/* Last Project */}
        <td className="px-4 py-3">
          <div className="text-sm">
            {projectName !== 'None' ? (
              <>
                <div className="truncate max-w-32">{projectName}</div>
                {projectScore !== null && (
                  <div className={`text-xs font-medium ${
                    projectScore >= 100 ? 'text-green-400' : 
                    projectScore >= 75 ? 'text-yellow-400' : 
                    'text-red-400'
                  }`}>
                    Score: {projectScore}
                  </div>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">No project</span>
            )}
          </div>
        </td>

        {/* Time */}
        <td className="px-4 py-3 text-sm text-center">
          {formatLogtime(user.total_logtime)}
        </td>
      </tr>
      
      {/* Mobile Card Layout */}
      <tr className="lg:hidden">
        <td colSpan={100}>
          <div className={`p-4 border-b border-border ${
            rank <= 3 ? 'bg-primary/5' : ''
          }`}>
            <div className="flex items-start space-x-4">
              {/* Avatar Section */}
              <div className="flex flex-col items-center flex-shrink-0 space-y-2">
                <a
                  href={`https://profile.intra.42.fr/users/${user.login}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block transition-opacity hover:opacity-80"
                >
                  <div className="w-14 h-14">
                    {user.image_url ? (
                      <img
                        src={user.image_url}
                        alt={user.name}
                        className="object-cover border rounded-full cursor-pointer w-14 h-14 border-border"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`w-14 h-14 rounded-full border border-border bg-muted flex items-center justify-center text-sm font-bold cursor-pointer ${user.image_url ? 'hidden' : ''}`}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                </a>
                
                {/* Info under photo */}
                <div className="flex flex-col items-center space-y-1 text-xs">
                  <div className={`font-bold text-lg ${rank <= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                    {rank === 1 && '👑'}
                    {rank === 2 && '🥈'}
                    {rank === 3 && '🥉'}
                    {rank > 3 && `#${rank}`}
                  </div>
                  <div className="font-bold text-primary">Lv.{user.level.toFixed(2)}</div>
                </div>
              </div>
              
              {/* User Info */}
              <div className="flex-1 min-w-0 space-y-2">
                {/* Name & Login with Status */}
                <div>
                  <div className="flex items-center space-x-2">
                    <a
                      href={`https://profile.intra.42.fr/users/${user.login}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-primary"
                    >
                      <div className="text-lg font-semibold truncate text-foreground" title={user.name}>{truncateName(user.name)}</div>
                    </a>
                    <span className={`text-sm px-2 py-0.5 rounded ${coalition.color}`}>
                      {coalition.name}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <a
                      href={`https://profile.intra.42.fr/users/${user.login}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-primary"
                    >
                      <div className="text-sm truncate text-muted-foreground">@{user.login}</div>
                    </a>
                    <div className="flex items-center space-x-1">
                      <span role="img" aria-label={statusText}>{statusIcon}</span>
                      <span className="text-xs">{statusText}</span>
                    </div>
                  </div>
                </div>
                
                {/* Compact Stats */}
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">🏆</span>
                    <span className="ml-1 font-semibold">{user.coalition_score?.toLocaleString() || '0'}</span>
                  </div>
                  <div>
                    <span className="font-semibold">${user.wallet}</span>
                  </div>
                  <div>
                    <span className="font-semibold">{formatLogtime(user.total_logtime)}</span>
                  </div>
                </div>
                
                {/* Last Project */}
                {projectName !== 'None' && (
                  <div className="pt-1">
                    <div className="flex items-center space-x-2">
                      <div className="text-sm font-medium truncate text-muted-foreground">{projectName}</div>
                      {projectScore !== null && (
                        <div className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          projectScore >= 100 ? 'bg-green-500/20 text-green-400' : 
                          projectScore >= 75 ? 'bg-yellow-500/20 text-yellow-400' : 
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {projectScore}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}

// Sortable header component
function SortableHeader({ 
  label, 
  sortKey, 
  currentSort, 
  currentOrder,
  onSort,
  align = 'center'
}: { 
  label: string; 
  sortKey: SortBy; 
  currentSort: SortBy; 
  currentOrder: SortOrder;
  onSort: (sort: SortBy) => void;
  align?: 'left' | 'center' | 'right';
}) {
  const isActive = currentSort === sortKey;
  const alignClass = align === 'left' ? 'text-left justify-start' : align === 'right' ? 'text-right justify-end' : 'text-center justify-center';
  
  return (
    <th 
      className={`px-4 py-3 text-sm font-medium cursor-pointer hover:bg-muted/50 transition-colors select-none ${alignClass}`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center space-x-1 ${alignClass}`}>
        <span>{label}</span>
        <span className={`text-xs transition-colors ${
          isActive ? 'text-primary' : 'text-muted-foreground/50'
        }`}>
          {isActive ? (currentOrder === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </div>
    </th>
  );
}

// Simple Filter Component
function LeaderboardFilters({ 
  statusFilter, 
  setStatusFilter,
  coalitionFilter,
  setCoalitionFilter,
  searchFilter,
  setSearchFilter,
  totalUsers,
  filteredCount
}: {
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  coalitionFilter: string;
  setCoalitionFilter: (coalition: string) => void;
  searchFilter: string;
  setSearchFilter: (search: string) => void;
  totalUsers: number;
  filteredCount: number;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>🔍 Search & Filter</CardTitle>
          <span className="text-sm text-muted-foreground">
            Showing {filteredCount} of {totalUsers} students
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Search */}
          <div className="sm:col-span-2 lg:col-span-1">
            <label htmlFor="search" className="block mb-2 text-sm font-medium">
              Search
            </label>
            <input
              id="search"
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Name or login..."
              className="w-full input"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label htmlFor="status" className="block mb-2 text-sm font-medium">
              Status
            </label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full input"
            >
              <option value="all">All</option>
              <option value="online">Online</option>
              <option value="alive">Active</option>
              <option value="frozen">Frozen</option>
              <option value="blackholed">Blackholed</option>
            </select>
          </div>

          {/* Coalition Filter */}
          <div>
            <label htmlFor="coalition" className="block mb-2 text-sm font-medium">
              Coalition
            </label>
            <select
              id="coalition"
              value={coalitionFilter}
              onChange={(e) => setCoalitionFilter(e.target.value)}
              className="w-full input"
            >
              <option value="all">All</option>
              <option value="471">Atreides</option>
              <option value="468">Corrino</option>
              <option value="467">Harkonnen</option>
              <option value="null">None</option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}



// Main Leaderboard View Component
export function LeaderboardView() {
  const [leaderboardType, setLeaderboardType] = useState<'42' | 'pong'>('42');
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [pongLeaderboard, setPongLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Filters and sorting
  const [sortBy, setSortBy] = useState<SortBy>('level');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [coalitionFilter, setCoalitionFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');

  // Handle sort click - toggle order if same column, or set new column with default order
  const handleSort = (newSortBy: SortBy) => {
    if (sortBy === newSortBy) {
      // Toggle order for same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New column - set appropriate default order
      setSortBy(newSortBy);
      // For names, default to ascending; for numbers and custom orders, default to descending
      const defaultOrder = ['name', 'login'].includes(newSortBy) ? 'asc' : 'desc';
      setSortOrder(defaultOrder);
    }
  };

  const fetch42Leaderboard = async () => {
    try {
      setError(null);
      const response = await fetch('https://api.smasse.xyz/leaderboard');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch 42 leaderboard: ${response.status}`);
      }
      
      const data = await response.json();
      setUsers(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch 42 leaderboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch 42 leaderboard data');
    }
  };

  const fetchPongLeaderboard = async () => {
    try {
      setError(null);
      // Template - replace with actual pong leaderboard API
      console.log('Template: Fetching pong leaderboard from backend API');
      
      // Simulate pong leaderboard data
      const mockPongData = [
        { id: 1, username: 'PongMaster', wins: 50, losses: 10, winRate: 83.3, totalGames: 60, rank: 1 },
        { id: 2, username: 'PaddleWizard', wins: 45, losses: 15, winRate: 75.0, totalGames: 60, rank: 2 },
        { id: 3, username: 'BallBouncer', wins: 40, losses: 20, winRate: 66.7, totalGames: 60, rank: 3 },
      ];
      
      setPongLeaderboard(mockPongData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch pong leaderboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch pong leaderboard data');
    }
  };

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      if (leaderboardType === '42') {
        await fetch42Leaderboard();
      } else {
        await fetchPongLeaderboard();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [leaderboardType]);

  // Filter and sort users
  const filteredAndSortedUsers = users
    .filter(user => {
      // REQUIRED CONDITIONS: User must meet ALL of these to be shown in leaderboard
      // ✅ Level > 0 (has progressed beyond the initial level)
      if (user.level <= 0) {
        return false;
      }
      
      // ✅ Total logtime > 0 (has logged time at the school)
      if (user.total_logtime <= 0) {
        return false;
      }
      
      // ✅ At least one project completed (has a last_project value that is not None)
      if (!user.last_project || user.last_project === 'None' || user.last_project.trim() === '') {
        return false;
      }
      
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'online' && !user.currently_logged_in) {
          return false;
        }
        if (statusFilter !== 'online' && user.status !== statusFilter) {
          return false;
        }
      }
      
      // Coalition filter
      if (coalitionFilter !== 'all') {
        if (coalitionFilter === 'null' && user.coalition_id !== null) {
          return false;
        }
        if (coalitionFilter !== 'null' && user.coalition_id?.toString() !== coalitionFilter) {
          return false;
        }
      }
      
      // Search filter
      if (searchFilter) {
        const search = searchFilter.toLowerCase();
        return (
          user.name.toLowerCase().includes(search) ||
          user.login.toLowerCase().includes(search)
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      // Handle special sort types
      if (sortBy === 'coalition') {
        comparison = getCoalitionSortValue(a.coalition_id) - getCoalitionSortValue(b.coalition_id);
        // For coalition and status, reverse the sort order interpretation
        return sortOrder === 'desc' ? comparison : -comparison;
      } else if (sortBy === 'status') {
        comparison = getStatusSortValue(a) - getStatusSortValue(b);
        // For coalition and status, reverse the sort order interpretation
        return sortOrder === 'desc' ? comparison : -comparison;
      } else if (sortBy === 'project') {
        comparison = getProjectSortValue(a.last_project) - getProjectSortValue(b.last_project);
      } else {
        // Handle regular fields
        let aValue: any = a[sortBy];
        let bValue: any = b[sortBy];
        
        // Handle null/undefined values
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return sortOrder === 'asc' ? -1 : 1;
        if (bValue == null) return sortOrder === 'asc' ? 1 : -1;
        
        // Handle different data types
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else {
          // Convert to strings for comparison
          const aStr = String(aValue).toLowerCase();
          const bStr = String(bValue).toLowerCase();
          comparison = aStr.localeCompare(bStr);
        }
      }
      
      // Apply sort order (normal for regular fields, project)
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  if (loading) {
    return (
      <div className="py-6 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <LoadingSpinner size="lg" text="Loading leaderboard..." className="py-12" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 mx-auto max-w-7xl sm:py-6 sm:px-6 lg:px-8">
      <div className="space-y-6">

        {/* Leaderboard Type Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <span>🏆</span>
                <span>Leaderboards</span>
              </span>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant={leaderboardType === '42' ? 'primary' : 'outline'}
                  onClick={() => setLeaderboardType('42')}
                >
                  42 School
                </Button>
                <Button
                  size="sm"
                  variant={leaderboardType === 'pong' ? 'primary' : 'outline'}
                  onClick={() => setLeaderboardType('pong')}
                >
                  Pong Games
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        {error && (
          <Alert variant="error">
            ⚠️ {error}
          </Alert>
        )}

        {/* Filters - Only show for 42 leaderboard */}
        {leaderboardType === '42' && (
          <>
            <LeaderboardFilters
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              coalitionFilter={coalitionFilter}
              setCoalitionFilter={setCoalitionFilter}
              searchFilter={searchFilter}
              setSearchFilter={setSearchFilter}
              totalUsers={users.length}
              filteredCount={filteredAndSortedUsers.length}
            />

            {/* Mobile Sort Controls */}
            <div className="lg:hidden">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <span role="img" aria-label="Sort">🔄</span>
                    <span>Sort Options</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="mobile-sort" className="block mb-2 text-sm font-medium">
                        Sort By
                      </label>
                      <select
                        id="mobile-sort"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortBy)}
                        className="w-full input"
                      >
                        <option value="level">Level</option>
                        <option value="name">Name</option>
                        <option value="coalition_score">Coalition Score</option>
                        <option value="wallet">Wallet</option>
                        <option value="total_logtime">Log Time</option>
                        <option value="Coalition">Coalition</option>
                        <option value="status">Status</option>
                        <option value="project">Last Project</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="mobile-order" className="block mb-2 text-sm font-medium">
                        Order
                      </label>
                      <select
                        id="mobile-order"
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                        className="w-full input"
                      >
                        <option value="desc">High to Low</option>
                        <option value="asc">Low to High</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Leaderboard Content */}
        {leaderboardType === '42' ? (
          /* 42 School Leaderboard */
          <Card>
            <CardHeader>
              <div className="flex flex-col space-y-4 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
                <CardTitle className="flex items-center space-x-2">
                  <span role="img" aria-label="Chart">📊</span>
                  <span>42 School Leaderboard</span>
                </CardTitle>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center space-x-1">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-semibold">{users.length}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full" aria-hidden="true"></span>
                    <span className="text-muted-foreground">Online:</span>
                    <span className="font-semibold text-green-400">{users.filter(u => u.currently_logged_in).length}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-muted-foreground">Active:</span>
                    <span className="font-semibold text-blue-400">{users.filter(u => u.status === 'alive').length}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-muted-foreground">Avg Level:</span>
                    <span className="font-semibold text-primary">{users.length > 0 ? (users.reduce((sum, u) => sum + u.level, 0) / users.length).toFixed(2) : '0'}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredAndSortedUsers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="hidden border-b lg:table-header-group border-border bg-muted/30">
                      <tr>
                        <th className="px-4 py-3 text-sm font-medium text-center">Rank</th>
                        <SortableHeader label="Student" sortKey="name" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} align="left" />
                        <SortableHeader label="Level" sortKey="level" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                        <SortableHeader label="Coalition Score" sortKey="coalition_score" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                        <SortableHeader label="C" sortKey="coalition" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                        <SortableHeader label="Status" sortKey="status" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                        <SortableHeader label="Wallet" sortKey="wallet" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                        <SortableHeader label="Last Project" sortKey="project" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                        <SortableHeader label="Logtime" sortKey="total_logtime" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSortedUsers.map((user, index) => (
                        <UserTableRow
                          key={user.id}
                          user={user}
                          rank={index + 1}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="mb-4 text-4xl">🔍</div>
                  <h3 className="mb-2 text-lg font-semibold">No students found</h3>
                  <p className="mb-4 text-muted-foreground">
                    Try adjusting your search filters.
                  </p>
                  <Button 
                    onClick={() => {
                      setSearchFilter('');
                      setStatusFilter('all');
                      setCoalitionFilter('all');
                    }}
                    variant="secondary"
                  >
                    Clear All Filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Pong Leaderboard */
          <Card>
            <CardHeader>
              <div className="flex flex-col space-y-4 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
                <CardTitle className="flex items-center space-x-2">
                  <span role="img" aria-label="Pong">🏓</span>
                  <span>Pong Leaderboard</span>
                </CardTitle>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center space-x-1">
                    <span className="text-muted-foreground">Total Players:</span>
                    <span className="font-semibold">{pongLeaderboard.length}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-muted-foreground">Total Games:</span>
                    <span className="font-semibold">{pongLeaderboard.reduce((sum, p) => sum + p.totalGames, 0)}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {pongLeaderboard.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-border bg-muted/30">
                      <tr>
                        <th className="px-4 py-3 text-sm font-medium text-center">Rank</th>
                        <th className="px-4 py-3 text-sm font-medium text-left">Player</th>
                        <th className="px-4 py-3 text-sm font-medium text-center">Wins</th>
                        <th className="px-4 py-3 text-sm font-medium text-center">Losses</th>
                        <th className="px-4 py-3 text-sm font-medium text-center">Win Rate</th>
                        <th className="px-4 py-3 text-sm font-medium text-center">Total Games</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pongLeaderboard.map((player, index) => (
                        <tr key={player.id} className={`border-b border-border hover:bg-muted/50 transition-colors ${
                          player.rank <= 3 ? 'bg-primary/5' : ''
                        }`}>
                          <td className="px-4 py-3 text-center">
                            <div className={`font-bold text-lg ${player.rank <= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                              {player.rank === 1 && '👑'}
                              {player.rank === 2 && '🥈'}
                              {player.rank === 3 && '🥉'}
                              {player.rank > 3 && `#${player.rank}`}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold">{player.username}</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="font-semibold text-green-400">{player.wins}</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="font-semibold text-red-400">{player.losses}</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className={`font-semibold ${
                              player.winRate >= 75 ? 'text-green-400' : 
                              player.winRate >= 50 ? 'text-yellow-400' : 
                              'text-red-400'
                            }`}>
                              {player.winRate.toFixed(1)}%
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="font-semibold">{player.totalGames}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="mb-4 text-4xl">🏓</div>
                  <h3 className="mb-2 text-lg font-semibold">No pong games yet</h3>
                  <p className="mb-4 text-muted-foreground">
                    Start playing to see rankings!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}