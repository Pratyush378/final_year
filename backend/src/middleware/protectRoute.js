import { clerkClient, requireAuth } from "@clerk/express";
import User from "../models/User.js";
import { upsertStreamUser } from "../lib/stream.js";

export const protectRoute = [
  requireAuth(),
  async (req, res, next) => {
    try {
      const clerkId = req.auth().userId;

      if (!clerkId) return res.status(401).json({ message: "Unauthorized - invalid token" });

      // Create the local record on first authenticated request as a fallback
      // when the Clerk-to-Inngest user.created event has not been delivered.
      let user = await User.findOne({ clerkId });

      if (!user) {
        const clerkUser = await clerkClient.users.getUser(clerkId);
        const email =
          clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;

        if (!email) {
          return res.status(422).json({ message: "Your Clerk account has no email address" });
        }

        const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email;
        user = await User.findOneAndUpdate(
          { clerkId },
          {
            $set: { name, email, profileImage: clerkUser.imageUrl || "" },
          },
          { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );

        await upsertStreamUser({ id: clerkId, name, image: user.profileImage });
      }

      // attach user to req
      req.user = user;

      next();
    } catch (error) {
      console.error("Error in protectRoute middleware", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
];
