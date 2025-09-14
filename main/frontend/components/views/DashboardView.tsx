import { useAuth } from '@/components/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui';

// Dashboard View Component
export function DashboardView() {
  const { user } = useAuth();

  const stats = [
    {
      title: 'Account Info',
      description: 'Your personal details',
      icon: '👤',
      color: 'bg-primary/10 text-primary',
      items: [
        { label: 'User ID', value: user?.id },
        { label: 'Email', value: user?.email },
        { label: 'Member since', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-' },
      ],
    },
    {
      title: 'SPA Features',
      description: 'Single Page Application benefits',
      icon: '⚡',
      color: 'bg-success/10 text-success',
      items: [
        { label: 'Page reloads', value: 'None ✅' },
        { label: 'Client routing', value: 'Active ✅' },
        { label: 'Auth protection', value: 'Enabled ✅' },
      ],
    },
    {
      title: 'Theme System',
      description: 'Customizable appearance',
      icon: '🎨',
      color: 'bg-accent/10 text-accent-foreground',
      items: [
        { label: 'Themes available', value: '4 themes' },
        { label: 'Dark mode', value: 'Supported ✅' },
        { label: 'Custom themes', value: 'Available ✅' },
      ],
    },
    {
      title: 'Components',
      description: 'Reusable UI elements',
      icon: '🧩',
      color: 'bg-warning/10 text-warning',
      items: [
        { label: 'Design system', value: 'Complete ✅' },
        { label: 'Accessibility', value: 'Built-in ✅' },
        { label: 'Responsive', value: 'Mobile-first ✅' },
      ],
    },
  ];

  return (
    <div className="max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader className="text-center px-4 sm:px-6">
            <div className="text-4xl sm:text-6xl mb-4 animate-bounce-gentle" role="img" aria-label="Home icon">🏠</div>
            <CardTitle className="text-2xl sm:text-3xl mb-2">
              Welcome to your Dashboard
            </CardTitle>
            <CardDescription className="text-base sm:text-lg">
              Hello <strong className="text-foreground">{user?.username}</strong>! Everything is styled with our new design system.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat, index) => (
            <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-3">
                <div className="flex items-start sm:items-center space-x-3">
                  <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center text-2xl transition-transform group-hover:scale-110 flex-shrink-0`} role="img" aria-label={stat.title}>
                    {stat.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base sm:text-lg leading-tight">{stat.title}</CardTitle>
                    <CardDescription className="text-sm mt-1">{stat.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stat.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-sm gap-1 sm:gap-0">
                      <span className="text-muted-foreground font-medium">{item.label}:</span>
                      <span className="font-medium text-foreground break-words">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}