# Graveyard visual playtest

At 844×390, actual keyboard and independent touch-pointer controls traversed the level, opened optional orbs, failed/retried both challenges, unlocked/refilled weapons, exhausted ammo, reflected shots, defeated skeletons and entered Core Clash. Separate connected-route play completed POC VII and entered Graveyard. No state mutation or artificial clock advancement was used.

Three weak details identified and fixed:

1. Reflection text hid the enemy's number pair. Moved it above the badge; inspected `graveyard-reflection2-a.png`, `graveyard-reflection2.png`, `graveyard-reflection2-b.png` to see the shield, backward shot and recovery while numbers stay readable.
2. A dormant orb still advertised OPEN. Its local prompt now disappears with the orb. Loaded screenshots show the subdued pedestal without a false interaction prompt.
3. Hits did not visibly displace the existing skeleton. Added brief shot-direction recoil and squash without changing its design or collision rules. Hit-motion captures show muzzle/projectile/impact/recovery.

Full browser acceptance passed after fixes. Original POC VII/boss assets and sources have no diff against Sites golden commit d3841bf7a562b29e290ef854808858017b1f1de7. See graveyard-results.json for exact coverage and timing. Physical iPhone Safari remains untested.
