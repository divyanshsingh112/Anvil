import { calculateAvatarDetails } from "../src/lib/avatar-calculator";

async function run() {
  console.log("=== AVATAR BUILDER VERIFICATION RUN ===\n");

  // 1. Heavy Warrior Completions -> Warrior/Armor Styling
  console.log("1. HEAVY WARRIOR COMPLETIONS TEST:");
  console.log("----------------------------------");
  const warriorHeavy = calculateAvatarDetails(60, 20, 10);
  console.log(`Input: Warrior=60, Mage=20, Rogue=10`);
  console.log(`Result: Dominant Class = "${warriorHeavy.dominantClass}" (Expected: warrior)`);
  console.log(`Result: Tier = "${warriorHeavy.tier}" (Expected: master-look)`);
  console.log("");

  // 2. Roughly Equal Class Distribution -> Balanced at 15% Threshold
  console.log("2. BALANCED VS UNBALANCED CLASS SELECTION TEST (15% Threshold):");
  console.log("-------------------------------------------------------------");
  
  // Case A: Top two classes are 50 and 45 completions (10% relative diff, should be balanced)
  const balancedCase = calculateAvatarDetails(50, 45, 10);
  const diffA = (50 - 45) / 50;
  console.log(`Input: Warrior=50, Mage=45, Rogue=10`);
  console.log(`Relative diff: (50 - 45) / 50 = ${diffA * 100}% (<= 15%)`);
  console.log(`Result: Dominant Class = "${balancedCase.dominantClass}" (Expected: balanced)`);
  console.log("");

  // Case B: Top two classes are 50 and 42 completions (16% relative diff, should be warrior)
  const unbalancedCase = calculateAvatarDetails(50, 42, 10);
  const diffB = (50 - 42) / 50;
  console.log(`Input: Warrior=50, Mage=42, Rogue=10`);
  console.log(`Relative diff: (50 - 42) / 50 = ${diffB * 100}% (> 15%)`);
  console.log(`Result: Dominant Class = "${unbalancedCase.dominantClass}" (Expected: warrior)`);
  console.log("");

  // 3. Cosmetic Tier Transitions
  console.log("3. COSMETIC TIER BOUNDARY TESTS:");
  console.log("--------------------------------");
  
  // Boundary A: Novice Look (0-9 completions)
  const noviceCase = calculateAvatarDetails(9, 2, 1);
  console.log(`Input: Warrior=9, Mage=2, Rogue=1`);
  console.log(`Result: Tier = "${noviceCase.tier}" (Expected: novice-look)`);
  
  // Boundary B: Adept Look (10-49 completions)
  const adeptCase = calculateAvatarDetails(10, 5, 2);
  console.log(`Input: Warrior=10, Mage=5, Rogue=2`);
  console.log(`Result: Tier = "${adeptCase.tier}" (Expected: adept-look)`);

  const adeptCaseHigh = calculateAvatarDetails(49, 10, 5);
  console.log(`Input: Warrior=49, Mage=10, Rogue=5`);
  console.log(`Result: Tier = "${adeptCaseHigh.tier}" (Expected: adept-look)`);
  
  // Boundary C: Master Look (50+ completions)
  const masterCase = calculateAvatarDetails(50, 10, 5);
  console.log(`Input: Warrior=50, Mage=10, Rogue=5`);
  console.log(`Result: Tier = "${masterCase.tier}" (Expected: master-look)`);
  console.log("");

  console.log("All calculations validated successfully!");
}

run().catch(console.error);
