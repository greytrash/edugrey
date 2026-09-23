# Per-shot VFX configuration. Frames are 1-based PNG indices (24 fps).
# wind = base wind in px/s at reference depth (negative x = blowing screen-left)
# ground = (y at far depth, y at near depth) ; occ_depth = pieces with depth below this are hidden by the mask
# depth_w = weights for (far, mid, near) bands ; scale = (sprite scale far, near)

B_WIND = (-70.0, 8.0)
A_WIND = (70.0, 6.0)
A_GRADE = dict(gain=(0.93, 1.0, 1.06), expo=0.96, haze=0.45)  # BGR gain: warmer, hazier Ronda light

SHOTS = {
    "B": {
        # side-mirror shot: camera on the moving car, background streaks
        1: dict(frames=(17, 33), rate=7, wind=(-520.0, 25.0), gust=0.2, depth_w=(0.3, 0.5, 0.2), scale=(0.35, 1.6),
                ground=(330, 470), cam=False, preroll=2.0, mb=1.0, focus=0.5, blur_k=3.0, side_p=0.8,
                excl_poly=[[(60, 40), (560, 40), (560, 0), (660, 0), (660, 130), (560, 130), (545, 340), (60, 340)]]),
        # car drives toward the viaduct / constructivist sculpture
        2: dict(frames=(34, 70), rate=18, wind=B_WIND, gust=0.4, depth_w=(0.4, 0.4, 0.2), scale=(0.35, 2.2),
                ground=(300, 472), mask="masks/B", mask_ymin=185, occ_depth=0.6, wake=9, wake_depth=0.64, focus=0.6,
                blur_k=4.0, preroll=3.5),
        # hood POV looking at the windshield: only near, fast, defocused pieces flying past
        3: dict(frames=(71, 106), rate=4, wind=(-330.0, 40.0), gust=0.3, depth_w=(0.0, 0.15, 0.85), scale=(0.5, 2.4),
                ground=None, cam=False, focus=0.2, blur_k=5.0, preroll=2.0, side_p=0.9, yrange_side=(-0.1, 0.5)),
        # car with roof rubbish, graffiti wall behind
        6: dict(frames=(164, 203), rate=8, wind=B_WIND, gust=0.35, depth_w=(0.65, 0.3, 0.05), scale=(0.35, 1.8),
                ground=(300, 505), mask="masks/B", occ_depth=0.8, focus=0.55, blur_k=4.5, preroll=3.0),
        # donuts in the smoke
        8: dict(frames=(274, 317), rate=15, wind=(-85.0, 6.0), gust=0.4, depth_w=(0.4, 0.4, 0.2), scale=(0.32, 2.0),
                ground=(252, 470), mask="masks/B", occ_depth=0.5, wake=6, wake_depth=0.5, focus=0.45, blur_k=4.0,
                preroll=3.0),
        # graffiti wall: noticeably increased density across all depths
        9: dict(frames=(318, 360), rate=26, wind=B_WIND, gust=0.4, depth_w=(0.5, 0.36, 0.14), scale=(0.3, 2.0),
                ground=(276, 478), mask="masks/B", occ_depth=0.45, focus=0.4, blur_k=4.5, preroll=4.0),
        # door opening: keep everything inside/over the car body untouched
        10: dict(frames=(361, 400), rate=15, wind=(-65.0, 6.0), gust=0.4, depth_w=(0.45, 0.35, 0.2), scale=(0.3, 2.0),
                 ground=(202, 470), focus=0.4, blur_k=4.0, preroll=3.5, mask="masks/B", occ_depth=0.55,
                 excl_keys={f: [(0, 30), (0, 480), (bx, 480), (tx, ty), (300, 140), (250, 34)] for f, (bx, tx, ty) in {
                     361: (340, 340, 250), 363: (420, 470, 30), 366: (600, 700, 20), 370: (650, 690, 10),
                     373: (760, 810, 0), 376: (770, 820, 0), 379: (560, 520, 10), 381: (340, 340, 250),
                     400: (340, 340, 250)}.items()}),
        # whip pan: a few heavily streaked pieces
        11: dict(frames=(401, 415), rate=5, wind=(-650.0, 0.0), gust=0.2, depth_w=(0.2, 0.5, 0.3), scale=(0.4, 1.8),
                 ground=None, cam=False, focus=0.5, blur_k=5.0, preroll=1.5, side_p=0.9, opacity=0.85),
    },
    "A": {
        # walking to the car
        1: dict(frames=(110, 192), rate=10, wind=A_WIND, gust=0.4, depth_w=(0.4, 0.4, 0.2), scale=(0.3, 1.8),
                ground=(300, 472), mask="masks/A", occ_depth=0.5, focus=0.5, blur_k=3.5, preroll=3.5, **A_GRADE),
        # close on the woman by the door, valley behind
        2: dict(frames=(193, 257), rate=9, wind=A_WIND, gust=0.4, depth_w=(0.6, 0.4, 0.0), scale=(0.28, 1.6),
                ground=(330, 478), mask="masks/A", occ_depth=1.0, focus=0.85, blur_k=3.0, preroll=3.5,
                excl_poly=[[(0, 0), (0, 480), (470, 480), (140, 110), (140, 0)], [(140, 0), (560, 0), (560, 130), (430, 140), (180, 60)]],
                **A_GRADE),
        # wide misty valley
        3: dict(frames=(258, 311), rate=12, wind=A_WIND, gust=0.4, depth_w=(0.45, 0.4, 0.15), scale=(0.28, 1.8),
                ground=(362, 478), mask="masks/A", occ_depth=0.35, focus=0.3, blur_k=3.5, preroll=3.5, **A_GRADE),
        # car side with the woman
        5: dict(frames=(379, 462), rate=12, wind=A_WIND, gust=0.4, depth_w=(0.5, 0.35, 0.15), scale=(0.3, 2.0),
                ground=(300, 505), mask="masks/A", key=True, occ_depth=0.8, focus=0.6, blur_k=3.5, preroll=3.5, **A_GRADE),
        # car drives off toward the bridge: increased density until the last frame
        7: dict(frames=(509, 529), rate=22, wind=A_WIND, gust=0.4, depth_w=(0.4, 0.4, 0.2), scale=(0.3, 2.0),
                ground=(300, 472), mask="masks/A", occ_depth=0.55, wake=8, wake_depth=0.58, focus=0.5, blur_k=3.5,
                preroll=4.0, **A_GRADE),
    },
}
