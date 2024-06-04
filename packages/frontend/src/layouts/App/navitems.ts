import { SideNavigationProps } from "@cloudscape-design/components";

/**
 * Define your Navigation Items here
 */
export const NavItems: SideNavigationProps.Item[] = [
  { text: "Home", type: "link", href: "/" },
  { type: "divider" },
  {
    text: "Demo",
    type: "section",
    items: [
      {
        text: "Realtime Inference",
        type: "link",
        href: "/demo/realtime-inference",
      },
    ],
  },
  { type: "divider" },
];
