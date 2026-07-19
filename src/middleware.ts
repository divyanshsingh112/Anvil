import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/habits/:path*",
    "/year/:path*",
    "/shop/:path*",
    "/leaderboard/:path*",
    "/profile/:path*",
    "/journal/:path*",
    "/rivals/:path*",
  ],
};
