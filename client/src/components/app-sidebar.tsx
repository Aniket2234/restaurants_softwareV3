import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  ChefHat,
  BarChart3,
  Settings,
  Package,
  FileText,
  Utensils,
  UserCog,
  DollarSign,
  Calendar,
  ChevronRight,
  Gift,
  Tag,
  Building2,
  Truck,
  Globe,
  Smartphone,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLocation } from "wouter";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

// Main essential menu items
const mainMenuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Billing / POS", url: "/billing", icon: ShoppingCart },
  { title: "Tables", url: "/tables", icon: Utensils },
  { title: "Kitchen Display", url: "/kitchen", icon: ChefHat },
  { title: "Menu", url: "/menu", icon: FileText },
];

// Grouped secondary items in collapsible sections
const menuGroups = [
  {
    label: "Operations",
    icon: Truck,
    items: [
      { title: "Delivery", url: "/delivery", icon: Truck },
      { title: "Online Orders", url: "/online-orders", icon: Globe },
      { title: "Digital Menu Orders", url: "/digital-menu-orders", icon: Smartphone },
      { title: "Reservations", url: "/reservations", icon: Calendar },
      { title: "Waiting List", url: "/waiting-list", icon: FileText },
      { title: "Events", url: "/events", icon: Calendar },
    ],
  },
  {
    label: "Customers",
    icon: Users,
    items: [
      { title: "Customers", url: "/customers", icon: Users },
      { title: "Loyalty Program", url: "/loyalty", icon: Gift },
      { title: "Gift Cards", url: "/gift-cards", icon: Gift },
      { title: "Feedback", url: "/feedback", icon: FileText },
    ],
  },
  {
    label: "Inventory",
    icon: Package,
    items: [
      { title: "Inventory", url: "/inventory", icon: Package },
      { title: "Purchase Orders", url: "/purchase-orders", icon: ShoppingCart },
      { title: "Suppliers", url: "/suppliers", icon: Building2 },
      { title: "Wastage", url: "/wastage", icon: FileText },
    ],
  },
  {
    label: "Staff & HR",
    icon: UserCog,
    items: [
      { title: "Staff", url: "/staff", icon: UserCog },
      { title: "Attendance", url: "/attendance", icon: FileText },
      { title: "Commission", url: "/commission", icon: DollarSign },
      { title: "User Roles", url: "/user-roles", icon: UserCog },
    ],
  },
  {
    label: "Finance",
    icon: DollarSign,
    items: [
      { title: "Expenses", url: "/expenses", icon: DollarSign },
      { title: "Payment Settlement", url: "/payment-settlement", icon: DollarSign },
      { title: "Accounting", url: "/accounting", icon: DollarSign },
      { title: "Tax Reports", url: "/tax-reports", icon: FileText },
      { title: "Invoices", url: "/invoices", icon: FileText },
      { title: "Day End Settlement", url: "/day-end-settlement", icon: DollarSign },
    ],
  },
  {
    label: "Marketing",
    icon: Tag,
    items: [
      { title: "Offers & Promotions", url: "/offers", icon: Tag },
      { title: "Coupons", url: "/coupons", icon: Tag },
      { title: "Marketing", url: "/marketing", icon: Tag },
      { title: "QR Codes", url: "/qr-codes", icon: FileText },
    ],
  },
  {
    label: "Analytics",
    icon: BarChart3,
    items: [
      { title: "Analytics", url: "/analytics", icon: BarChart3 },
      { title: "Reports", url: "/reports", icon: FileText },
      { title: "Sales Detailed", url: "/sales-detailed", icon: BarChart3 },
      { title: "Item Performance", url: "/item-performance", icon: BarChart3 },
      { title: "Kitchen Performance", url: "/kitchen-performance", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    icon: Settings,
    items: [
      { title: "Multi-Location", url: "/multi-location", icon: Building2 },
      { title: "Integrations", url: "/integrations", icon: FileText },
      { title: "Printer Config", url: "/printer-config", icon: FileText },
      { title: "Email Templates", url: "/email-templates", icon: FileText },
      { title: "Notifications", url: "/notifications", icon: FileText },
      { title: "Audit Logs", url: "/audit-logs", icon: FileText },
      { title: "Database", url: "/database", icon: FileText },
      { title: "Backup", url: "/backup", icon: FileText },
    ],
  },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavigation = (url: string) => {
    setLocation(url);
    // Auto-close sidebar on mobile when clicking a menu item
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar className="border-r border-gray-200 dark:border-gray-800">
      <SidebarContent className="bg-white dark:bg-gray-900">
        {/* Logo/Brand */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold text-red-600 dark:text-red-500 px-4 py-4 flex items-center gap-2">
            <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">
              POS
            </div>
            RestaurantPOS
          </SidebarGroupLabel>
        </SidebarGroup>

        {/* Essential Menu Items - Always Visible */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    className={cn(
                      "transition-colors text-gray-700 dark:text-gray-300",
                      location === item.url && "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium"
                    )}
                  >
                    <a
                      href={item.url}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation(item.url);
                      }}
                      className="flex items-center gap-2"
                    >
                      <item.icon className={cn(
                        "h-4 w-4",
                        location === item.url ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400"
                      )} />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Collapsible Menu Groups */}
        {menuGroups.map((group) => {
          const GroupIcon = group.icon;
          const hasActiveItem = group.items.some(item => item.url === location);
          
          return (
            <SidebarGroup key={group.label}>
              <Collapsible defaultOpen={hasActiveItem} className="group/collapsible">
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="w-full hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
                    <div className="flex items-center gap-2 px-2 py-2">
                      <GroupIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {group.label}
                      </span>
                      <ChevronRight className="ml-auto h-4 w-4 text-gray-400 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </div>
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            isActive={location === item.url}
                            data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                            className={cn(
                              "pl-8 transition-colors text-sm text-gray-600 dark:text-gray-400",
                              location === item.url && "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium"
                            )}
                          >
                            <a
                              href={item.url}
                              onClick={(e) => {
                                e.preventDefault();
                                handleNavigation(item.url);
                              }}
                              className="flex items-center gap-2"
                            >
                              <item.icon className={cn(
                                "h-3.5 w-3.5",
                                location === item.url ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-500"
                              )} />
                              <span>{item.title}</span>
                            </a>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          );
        })}

        {/* Settings at Bottom */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/settings"}
                  data-testid="nav-settings"
                  className={cn(
                    "transition-colors text-gray-700 dark:text-gray-300",
                    location === "/settings" && "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium"
                  )}
                >
                  <a
                    href="/settings"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavigation("/settings");
                    }}
                    className="flex items-center gap-2"
                  >
                    <Settings className={cn(
                      "h-4 w-4",
                      location === "/settings" ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400"
                    )} />
                    <span>Settings</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/help"}
                  data-testid="nav-help"
                  className={cn(
                    "transition-colors text-gray-700 dark:text-gray-300",
                    location === "/help" && "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium"
                  )}
                >
                  <a
                    href="/help"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavigation("/help");
                    }}
                    className="flex items-center gap-2"
                  >
                    <FileText className={cn(
                      "h-4 w-4",
                      location === "/help" ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400"
                    )} />
                    <span>Help & Support</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
