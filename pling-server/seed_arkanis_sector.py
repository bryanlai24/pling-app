#!/usr/bin/env python3
"""
Seed objectives for "The Arkanis Sector" trophy.

Structure:
  Parent objectives = areas (Mos Eisley, Mos Espa, Jundland Wastes, Tatooine Space,
                              Stalgasin Hive, Geonosis Space)
  Leaf objectives   = individual puzzles / challenges within each area

Usage:
  python3 seed_arkanis_sector.py <bearer_token> <achievement_id>

Find the achievement_id by hitting:
  GET /api/achievements/game/<game_id>
and locating "The Arkanis Sector" in the results.
"""

import sys
import json
import ssl
import time
import urllib.request
import urllib.error

BASE_URL = "https://pling-server-997771527995.us-central1.run.app/api"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def post(path, token, data):
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(data).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def create_parent(token, achievement_id, title, sort_order):
    status, resp = post(f"/objectives/achievement/{achievement_id}", token, {
        "title": title,
        "method": None,
        "sort_order": sort_order,
        "parent_objective_id": None,
    })
    if status in (200, 201):
        print(f"  ✅ Parent: {title}")
        return resp["id"]
    else:
        print(f"  ❌ Failed parent '{title}': {status} — {resp}")
        return None


def create_leaf(token, achievement_id, parent_id, title, method, sort_order):
    status, resp = post(f"/objectives/achievement/{achievement_id}", token, {
        "title": title,
        "method": method,
        "sort_order": sort_order,
        "parent_objective_id": parent_id,
    })
    if status in (200, 201):
        print(f"      ✅ {title}")
    else:
        print(f"      ❌ Failed '{title}': {status} — {resp}")
    time.sleep(0.05)


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 seed_arkanis_sector.py <token> <achievement_id>")
        sys.exit(1)

    token = sys.argv[1]
    achievement_id = sys.argv[2]

    # ── Data ──────────────────────────────────────────────────────────────────
    # Format: (area_title, [(puzzle_name, method_or_None), ...])
    # method = brief how-to hint shown when the objective is expanded

    areas = [
        (
            "Mos Eisley",
            [
                ("Welcome to Mos Eisley!", "Stack and Force-lift a droid at the Landing Pad to reach the brick above."),
                ("Dome Alone", "Climb to the top of a domed building in the northwest area."),
                ("Patch Job", "Use a Scavenger's Breaker Blaster on a cracked wall in the northwest."),
                ("Tower Topper", "Grapple up the tall metallic tower east of the docking bays."),
                ("Junkshop Jolt", "Power up an energy cell slot to unlock the building in the northwest."),
                ("Grappling to Glory", "Grapple up a series of rails in the center of town."),
                ("Hangar Bay Fray", "Saber-slash the wall in the southwest docking bay to reveal the brick."),
                ("Trade Tower Trial", "Timed 80-second climb to the top of the central Trade Tower."),
                ("Cantina Cobweb Cleanup", "Smash the cobweb at the back of Chalmun's Cantina and jump up."),
                ("Dance in the Cantina", "Use a Jedi Mind Trick on 5 NPCs to make them dance simultaneously inside the Cantina."),
                ("EG-6 = Easy Bricks", "Smash all 8 marked EG-6 power droids in the southeast corner."),
                ("Keen Eyes in Eisley", "Find the hidden ledge brick east of where Luke parks his speeder."),
                ("Akim's Munch Bunch", "Rotate flagpole switches to raise flags, then flip up on the poles in the southwest."),
                ("He Came From the Clouds", "After visiting Bespin, a pilot crash-lands in Mos Eisley — blast his gold ship with a Bounty Hunter."),
                ("Left Behind", "Use C-3PO to unlock a door, then a Bounty Hunter to break a gold cage inside."),
                ("Lighting On The Wall", "Flip switches inside an east-side building to align three light machines."),
                ("Imperial Checkpoint", "Use an Astromech Droid and a Jedi/Dark Side character to pass the Imperial Checkpoint gate."),
                ("Rebel Hideout", "Use a Protocol Droid and a Jedi/Dark Side character to enter the hidden rebel base in the southwest."),
                ("Through The Bars", "Retrieve the brick visible behind bars using a small droid."),
                ("One Trooper's Trash", "Smash junk piles near the Stormtrooper area."),
                ("Who Shot Fastest", "Shoot a series of targets in a duel-style challenge."),
                ("Drape It Like It's Hot", "Use the Force to hang fabric decorations on hooks around the area."),
                ("Eye of the Crystal Moon", "Locate and activate a crystal eye-shaped fixture."),
                ("Flail With Honor", "Defeat enemies using a flail-style combat attack."),
                ("Splat a Womp Rat", "Talk to the shopkeeper and use a turret to shoot a set of womp rats."),
                ("Gonk-Stores Paradise", "Escort a Gonk droid safely through Mos Eisley, then pay studs to claim the brick."),
                ("Working for Tips", "Complete a service task in the market district."),
                ("Junk Market Race", "Race through 21 green checkpoints atop the southern market building."),
            ],
        ),
        (
            "Mos Espa",
            [
                ("Welcome to Mos Espa!", "Smash boxes in a half-buried engine behind your ship at the Landing Pad."),
                ("Power Below the Porch", "Find two batteries to power up a building southwest of the Landing Pad."),
                ("Toydarian Treasure", "Use a Bounty Hunter to blast a gold crate on the east side of town."),
                ("Scaling the Dome", "Climb to the very top of the dome in the southeast part of town."),
                ("Kyber Climb", "Pull four levers to raise planks at the central construction site."),
                ("Ghost Protocol", "Follow a protocol droid 'ghost' through a haunted hovel east of Anakin's house using a Protocol Droid."),
                ("Rodian Raid", "Solve the Protocol Droid and Astromech puzzle at 'Scrap On Tap' and fend off Rodians."),
                ("Suburban Spoils", "Press 4 pressure pads within 20 seconds."),
                ("Slave Quarters Water", "Arrange curved and twisted pipes in the Slave Quarters to fill and burst tank #5."),
                ("Scattered Schematics", "Collect scattered schematic pieces around the Slave Quarters area."),
                ("Hovel Hotshot", "Reach the brick at the top of a small hovel."),
                ("Booma Ball", "Score 900+ points in 59.5 seconds in the Booma Ball mini-game in the Cafe Quarter (northeast)."),
                ("Podracer Prize", "Use C-3PO to speak to a civilian, then R2-D2 to solve the assembled podracer puzzle."),
                ("Probe Droid Pursuit", "Chase the probe droid through town and catch it."),
                ("Rooftop Raiding", "Reach the brick on the rooftop via the specific climbing route."),
                ("Nice Little Nook", "Access a hidden nook in a building using a small character or droid."),
                ("Storeroom Stock", "Enter the locked storeroom and collect the brick inside."),
                ("Covert Cache", "Find the cache hidden behind a concealed entrance."),
                ("Top of the Tower", "Climb to the top of the tower in the market district."),
                ("Pillar of Wealth", "Use the Force or stacking to reach the brick on top of the pillar."),
                ("Settlement Stacking", "Stack objects to reach the elevated brick."),
                ("Another Brick on a Wall", "Retrieve the brick embedded in or behind a wall section."),
                ("Nook and Cranny", "Small access point puzzle using a mini droid or child character."),
                ("Sunken Sand Silver", "Dig or access the brick buried in the sunken area."),
                ("Tower Treasure", "Find the treasure cache at the top of the secondary tower."),
                ("Disappearing Droids", "Chase or find droids that vanish around town."),
                ("Guardian Gonk", "Complete the Gonk droid challenge using the specific required interaction."),
                ("Downtown Lockdown", "Access the locked-down area using the correct character type."),
                ("Akim's Munch Bunch", "Rotate flagpole switches to raise flags, then flip up on the poles."),
                ("Wupiupi Whoopee", "Visit Maz's Castle to recover Watto's money from deadbeats, then return to Watto's Junkshop."),
                ("For Pit-y's Sake", "Help the pit droid find 5 escaped droids scattered around Mos Espa."),
                ("Pod Parts Procurement", "Gather podracer parts from around Mos Espa for the NPC in need."),
            ],
        ),
        (
            "Jundland Wastes",
            [
                ("Welcome to the Jundland Wastes!", "Find the first brick near the entry area of the Jundland Wastes."),
                ("Transport Ship Treasure", "Locate the brick on or near a crashed transport ship."),
                ("Womp There It Is", "Smash or interact with womp rat-related objects to reveal the brick."),
                ("Sandy Soccer", "Roll or kick a ball into a goal to earn the brick."),
                ("Top of the Shop", "Reach the rooftop of the desert shop."),
                ("Luke's Workshop", "Find the brick inside or on top of Luke Skywalker's homestead/workshop."),
                ("Vaporator Invigorator", "Interact with the moisture vaporators in the area."),
                ("Mombay M'bwa", "Solve the creature/NPC interaction puzzle."),
                ("Light the Way", "Light torches or lamps in sequence in the cave high up east of Tosche Station."),
                ("Tatooine Treasure Hunt", "Complete this multi-step exploration challenge across the Jundland Wastes."),
                ("Precious Precipice", "Reach the ledge on the dangerous cliff edge."),
                ("Cliff Climber", "Climb up the cliff face using the specific handholds."),
                ("Stony Sightseeing", "Reach the overlook atop the rocky formation."),
                ("High-Up Hidey Hole", "Access the hidden alcove high on the rock face."),
                ("Imperial Cache", "Open the Imperial supply crate using the correct character type."),
                ("Scaling the Spire", "Climb the tall rock spire or column to reach the brick."),
                ("High Over the Homestead", "Reach the brick hovering high above the Lars homestead area."),
                ("Tusken Tussle", "Fight or interact with Tusken Raiders to secure the brick."),
                ("Cliff Jumper", "Leap across the cliff gaps to reach the brick on the other side."),
                ("Gully Glide", "Traverse through the gully/canyon passage to find the brick."),
                ("Pillar Palavar", "Climb and activate the stone pillars in the cavern near the Tusken Raider camp."),
                ("Tusken Treasure", "Find the loot hidden in or near the Tusken Raider encampment."),
                ("Jawa Japes", "Trick or interact with the Jawas to obtain the brick."),
                ("Cliff Climbing", "Complete the secondary cliff-climbing challenge in a different part of the map."),
                ("Tatooine Time Trial", "Extinguish 6 torches in under 49 seconds to claim the brick."),
                ("Cosy Campfires", "Light or interact with the campfires scattered through the Wastes."),
                ("Seeya Later Excavator", "Solve the puzzle involving excavation machinery."),
                ("Remember Owning a Droid", "Use an Astromech droid to access the droid-specific puzzle."),
                ("Cave Cache", "Find the brick hidden inside the desert cave."),
                ("Krayt Cavity", "Locate the brick inside the Krayt Dragon skull or cave."),
                ("Balcony Bounce", "Bounce up to the balcony using awnings or trampolines."),
                ("Rocky Reception", "Reach the brick on the rocky outcrop using the correct approach."),
                ("Battle Droid Royale", "Defeat the battle droids in this combat challenge."),
                ("Hot Pursuit", "Chase the 'Kyber Swiper' character on the far east side near Jabba's Palace and swat it."),
            ],
        ),
        (
            "Tatooine Space",
            [
                ("Kyber Brick Comet", "Shoot down the large blue Kyber Comet orbiting Tatooine in your starship to earn 5 Kyber Bricks."),
            ],
        ),
        (
            "Stalgasin Hive (Geonosis)",
            [
                ("Welcome to Geonosis!", "Destroy the pebbles blocking bars near the landing site and jump up."),
                ("Landing Pad Lookout", "Climb the bars high on the mountain behind your ship at the Landing Pad."),
                ("Cave Critter", "Remove or defeat the creature blocking the cave entrance."),
                ("Confederate Cooperation", "Access the Confederate/Separatist-themed structure using the correct character type."),
                ("Quick Meeting", "Shoot all six targets on the walls of the meeting room."),
                ("Dooku's Doorway", "Access the door associated with Count Dooku's lair area."),
                ("Wandering Wookiee", "Find and assist the lost Wookiee wandering the map."),
                ("Bug House Break-in", "Break into the bug-housing structure."),
                ("Locker Room Larks", "Navigate the locker room and open lockers to find the brick."),
                ("Launchpad Ledge", "Reach the ledge adjacent to the launch platform."),
                ("Secret Silver", "Use a Bounty Hunter to blast the silver/gold crate in the hidden spot."),
                ("Animal Handler Handler", "Go to the north-side room and interact with the caged animals to solve the puzzle."),
                ("Red Rock Shootout", "Shoot targets on the red rock formations."),
                ("Factory Sealed", "Use a Scavenger or Jedi to access the card-locked cupboard inside the factory/Storage on the north side."),
                ("Foundry Flow", "Navigate the flow-based puzzle in the foundry area."),
                ("Pipe Dream", "Solve the pipe-routing puzzle inside the factory."),
                ("Little Lookout", "Reach the small elevated perch/lookout point."),
                ("Geonosian Gold", "Northwest of the Landing Pad inside a cave entrance — use a Bounty Hunter to blast the gold crate."),
                ("Bricky in the Middle", "Access the brick in the middle of the contested or walled area."),
                ("Hard Rock", "Reach the brick on or inside particularly tough rocky terrain."),
                ("Droids in Disarray", "Interact with the scattered/malfunctioning droids to solve the puzzle."),
                ("Skyward Spire", "Climb up the column of rock using the brown bars to reach the top."),
                ("Factory Overlook", "Reach the overlook above the factory interior."),
                ("Canyon Crate Conundrum", "From the central rock formation's upper level, activate 4 wall buttons in under 20 seconds using the Force to move a crate."),
                ("Kyber in the Canyon", "On a high ledge northwest of the Landing Pad — reach via the central rock formation's west side with a Scavenger's Net Launcher."),
                ("For The Greater Gonk", "Escort 'Gonketta' the Gonk droid safely across Geonosis."),
                ("Creature Calamity", "Fight the three arena creatures: Nexu, Reek, and Acklay."),
            ],
        ),
        (
            "Geonosis Space",
            [
                ("Kyber Brick Comet", "Shoot down the large blue Kyber Comet orbiting Geonosis in your starship to earn 5 Kyber Bricks."),
            ],
        ),
    ]

    # ── Seed ─────────────────────────────────────────────────────────────────
    print(f"\nSeeding objectives for achievement: {achievement_id}\n")

    for area_sort, (area_title, puzzles) in enumerate(areas):
        print(f"\n[{area_sort + 1}/{len(areas)}] {area_title} ({len(puzzles)} puzzles)")
        parent_id = create_parent(token, achievement_id, area_title, area_sort)
        if not parent_id:
            continue

        for puzzle_sort, (puzzle_name, method) in enumerate(puzzles):
            create_leaf(token, achievement_id, parent_id, puzzle_name, method, puzzle_sort)

    print("\n✅ Done! Verify names against your in-game Side Missions screen.")
    print("   Run with --dry-run flag (not yet implemented) to preview without posting.")


if __name__ == "__main__":
    main()
