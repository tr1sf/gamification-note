const vi: Record<string, string> = {
  // Core
  "Tavern Hall": "Đại Sảnh",
  "My Scrolls": "Thư Viện",
  "New Scroll": "Cuộn Mới",
  "Quests": "Nhiệm Vụ",
  "Challenges": "Thử Thách",
  "Boss Fight": "Đấu Boss",
  "Quiz Review": "Ôn Quiz",
  "Daily Rituals": "Thói Quen",
  "Guilds": "Hội Nhóm",
  "Progress": "Tiến Độ",
  "Insights": "Phân Tích",
  "AI Quests": "NV AI",
  "Potion Match": "Ghép Dược",
  "Profile": "Hồ Sơ",
  "Shop": "Cửa Hàng",
  "Analytics": "Thống Kê",
  "Account": "Tài Khoản",
  "Adventures": "Phiêu Lưu",
  "Main Hall": "Chính Sảnh",
  "Scrolls": "Cuộn Giấy",

  // Actions
  "Write your first scroll": "Viết cuộn giấy đầu tiên",
  "View your character sheet": "Xem hồ sơ nhân vật",
  "Claim your welcome gift": "Nhận quà chào mừng",
  "Continue →": "Tiếp Tục →",
  "← Back": "← Quay Lại",
  "Enter the Tavern →": "Vào Quán Trọ →",

  // Onboarding
  "Choose Your Path": "Chọn Con Đường",
  "What brings you to the tavern?": "Điều gì đưa bạn đến quán trọ?",
  "What Motivates You?": "Động Lực Của Bạn?",
  "Choose your adventure style": "Chọn phong cách phiêu lưu",
  "Your First Quest": "Nhiệm Vụ Đầu Tiên",
  "Complete these tasks to begin your journey": "Hoàn thành để bắt đầu hành trình",

  // Stats
  "Notes": "Ghi Chú",
  "Level": "Cấp Độ",
  "Streak": "Chuỗi Ngày",
  "Coins": "Xu",
  "XP": "KN",

  // Notifications
  "Notification Settings": "Cài Đặt Thông Báo",
  "Desktop notifications": "Thông báo desktop",
  "Quest completed": "Nhiệm vụ hoàn thành",
  "Level up": "Lên cấp",
  "Streak warnings": "Cảnh báo streak",
  "Guild activity": "Hoạt động hội",
  "Weekly recap": "Tổng kết tuần",

  // Boss
  "HP": "Máu",
  "Boss Defeated!": "Đã Hạ Boss!",
  "Claim Loot!": "Nhận Chiến Lợi Phẩm!",
  "Battle Log": "Nhật Ký Chiến Đấu",
  "No attacks yet. Strike first!": "Chưa có đòn đánh nào. Tấn công đi!",
  "Write Note": "Viết Ghi Chú",
  "Review Quiz": "Ôn Quiz",
  "Daily Ritual": "Thói Quen",

  // Game
  "Perfect!": "Hoàn Hảo!",
  "Great work!": "Tuyệt Vời!",
  "Good effort!": "Cố Gắng Tốt!",
  "Play Again": "Chơi Lại",
  "Pairs": "Cặp",
  "Flips": "Lượt Lật",
};

export function t(key: string): string {
  const lang = typeof localStorage !== "undefined" ? localStorage.getItem("lang") : null;
  if (lang === "vi" && vi[key]) return vi[key];
  return key;
}

export function getCurrentLang(): "en" | "vi" {
  if (typeof localStorage === "undefined") return "en";
  return (localStorage.getItem("lang") as "en" | "vi") || "en";
}

export function applyLanguage(lang: "en" | "vi"): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem("lang", lang);
  document.documentElement.setAttribute("lang", lang);
}
