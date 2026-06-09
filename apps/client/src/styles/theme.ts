import type { ThemeConfig } from 'antd';

const fontStack =
  "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#2563eb',
    colorInfo: '#2563eb',
    colorLink: '#2563eb',
    colorBgLayout: '#f5f6f8',
    colorText: '#1c2230',
    colorTextSecondary: '#5b6477',
    colorBorderSecondary: '#eceef1',
    borderRadius: 8,
    borderRadiusLG: 12,
    fontSize: 14,
    fontFamily: fontStack,
    controlHeight: 36,
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      headerHeight: 64,
      headerPadding: '0 24px',
      bodyBg: '#f5f6f8',
      siderBg: 'transparent',
    },
    Menu: {
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'transparent',
      darkPopupBg: '#181d27',
      darkItemColor: '#a3adc2',
      darkItemHoverColor: '#ffffff',
      darkItemHoverBg: 'rgba(255,255,255,0.07)',
      darkItemSelectedBg: 'rgba(91,155,255,0.16)',
      darkItemSelectedColor: '#ffffff',
      itemHeight: 44,
      itemMarginInline: 12,
      itemMarginBlock: 4,
      itemBorderRadius: 10,
      iconSize: 17,
      fontSize: 14,
    },
    Button: {
      fontWeight: 600,
      primaryShadow: '0 6px 16px rgba(37,99,235,0.20)',
    },
    Card: {
      borderRadiusLG: 14,
    },
    Table: {
      headerBg: '#f7f8fa',
      headerColor: '#5b6477',
      borderColor: '#eceef1',
    },
  },
};
