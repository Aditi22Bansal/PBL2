/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import axios from "axios";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

async function getAuthenticatedEmail() {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

export async function GET() {
  try {
    const email = await getAuthenticatedEmail();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = await axios.get(`${BACKEND_URL}/api/student/profile`, {
      headers: { "X-User-Email": email },
    });
    return NextResponse.json(res.data);
  } catch (error: any) {
    console.error("GET profile proxy failed:", error.response?.data || error.message);
    return NextResponse.json(
      { error: "Backend error", details: error.response?.data || error.message },
      { status: error.response?.status || 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const email = await getAuthenticatedEmail();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const res = await axios.put(`${BACKEND_URL}/api/student/profile`, body, {
      headers: { "X-User-Email": email, "Content-Type": "application/json" },
    });
    return NextResponse.json(res.data);
  } catch (error: any) {
    console.error("PUT profile proxy failed:", error.response?.data || error.message);
    return NextResponse.json(
      { error: "Backend error", details: error.response?.data || error.message },
      { status: error.response?.status || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const email = await getAuthenticatedEmail();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const res = await axios.post(`${BACKEND_URL}/api/student/profile/submit`, body, {
      headers: { "X-User-Email": email, "Content-Type": "application/json" },
    });
    return NextResponse.json(res.data);
  } catch (error: any) {
    console.error("POST profile proxy failed:", error.response?.data || error.message);
    return NextResponse.json(
      { error: "Backend error", details: error.response?.data || error.message },
      { status: error.response?.status || 500 }
    );
  }
}
