import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Validate required fields
    const { name, organisation, email, enquiryType } = data;
    if (!name || !organisation || !email || !enquiryType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Log the submission (replace with email/CRM integration)
    console.log("Contact form submission:", {
      timestamp: new Date().toISOString(),
      ...data,
    });

    // TODO: Integrate with email service (SendGrid, Resend, etc.)
    // TODO: Integrate with HubSpot CRM
    // TODO: Send auto-response email to submitter

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
