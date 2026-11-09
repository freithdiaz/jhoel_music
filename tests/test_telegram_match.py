import pytest

from telegram_match import best_match, candidate_line, quality_tier, receipt_matches_selection


def result(label, context, identifier='a' * 43, relation='indeterminado'):
    return {'id': identifier, 'label': label, 'context': context, 'relation': relation}


def test_numeric_button_uses_its_unique_context_line():
    item = result('2', 'Resultados\n1. Otra canción - Otro artista\n2. Imitadora - Romeo Santos')
    assert candidate_line(item) == 'Imitadora - Romeo Santos'
    assert candidate_line(result('2', 'Resultados\n2. Una\n2. Otra')) is None


def test_quality_prefers_320_over_128_when_title_matches():
    target = {'title': 'Imitadora', 'artist': 'Romeo Santos', 'duration': 235}
    context = ('Resultados\n1. Imitadora - Romeo Santos (128 kbps)\n'
               '2. Imitadora - Romeo Santos (320 kbps)')
    match = best_match(target, [result('1', context, 'a' * 43), result('2', context, 'b' * 43)])
    assert match is not None
    assert match['result']['id'] == 'b' * 43
    assert match['quality'] == 4


def test_exact_title_and_artist_are_required():
    target = {'title': 'Imitadora', 'artist': 'Romeo Santos'}
    assert best_match(target, [result('Imitadora - Otro artista', 'x')]) is None
    assert best_match(target, [result('Otra canción - Romeo Santos', 'x')]) is None


def test_cover_or_live_is_not_selected_unless_requested():
    target = {'title': 'Imitadora', 'artist': 'Romeo Santos'}
    assert best_match(target, [result('Imitadora (Cover) - Romeo Santos', 'x')]) is None
    assert best_match(target, [result('Imitadora (Live) - Romeo Santos', 'x')]) is None
    live = best_match({'title': 'Imitadora (Live)', 'artist': 'Romeo Santos'},
                      [result('Imitadora (Live) - Romeo Santos', 'x')])
    assert live is not None


def test_generic_single_word_title_does_not_match_a_longer_song():
    target = {'title': 'Amor', 'artist': 'Artista'}
    assert best_match(target, [result('Amor Prohibido - Artista', 'x')]) is None


def test_accents_and_numeric_context_are_normalized():
    target = {'title': 'Quédate', 'artist': 'Beéle'}
    context = 'Resultados\n1. Quédate - Beéle (320 kbps)'
    match = best_match(target, [result('1', context)])
    assert match is not None
    assert match['title_score'] == 1.0


def test_unsupported_format_is_not_auto_selected():
    target = {'title': 'Imitadora', 'artist': 'Romeo Santos'}
    assert best_match(target, [result('Imitadora - Romeo Santos (FLAC)', 'x')]) is None
    assert quality_tier('Imitadora - Romeo Santos (320 kbps)') == 4
    assert quality_tier('Imitadora - Romeo Santos 320k') == 4
    assert quality_tier('Imitadora - Romeo Santos (FLAC)') == 0


def test_exact_duplicate_candidates_choose_the_first():
    target = {'title': 'Imitadora', 'artist': 'Romeo Santos'}
    context = 'Resultados\n1. Imitadora - Romeo Santos (320 kbps)\n2. Imitadora - Romeo Santos (320 kbps)'
    match = best_match(target, [result('1', context, 'a' * 43), result('2', context, 'b' * 43)])
    assert match is not None
    assert match['result']['id'] == 'a' * 43


def test_equivalent_candidates_with_different_duration_are_left_for_manual_choice():
    target = {'title': 'Imitadora', 'artist': 'Romeo Santos'}
    context = ('Resultados\n1. Imitadora - Romeo Santos (320 kbps) 4:30\n'
               '2. Imitadora - Romeo Santos (320 kbps) 3:55')
    assert best_match(target, [result('1', context, 'a' * 43), result('2', context, 'b' * 43)]) is None


def test_bot_metadata_and_unknown_sender_do_not_block_a_clear_match():
    target = {'title': 'Feid, Maisak - SE ME OLVIDA', 'artist': 'Feid', 'duration': 228}
    lines = [
        'Resultados',
        '1. Karaoke Live – Feid, Maisak - SE ME OLVIDA 3:45 3.6M 132k',
        '2. <unknown> – Feid, Maisak - SE ME OLVIDA 3:48 8.7M 320k',
        '3. Feid, Maisak - SE ME OLVIDA 3:49 2.8M 102k',
        '4. <unknown> – Feid, Maisak - SE ME OLVIDA 3:48 8.7M 320k',
        '5. FeidVEVO – Feid, Maisak - SE ME OLVIDA 3:49 3.7M 134k',
        '6. Feid, Maisak - SE ME OLVIDA 3:48 7.0M 258k',
    ]
    context = '\n'.join(lines)
    results = [result(str(index), context, str(index) * 43)
               for index in range(1, 7)]
    match = best_match(target, results)
    assert match is not None
    assert match['result']['label'] == '2'
    assert match['quality'] == 4
    assert match['title_score'] == 1.0


def test_duration_breaks_a_quality_tie():
    target = {'title': 'Imitadora', 'artist': 'Romeo Santos', 'duration': 235}
    context = ('Resultados\n1. Imitadora - Romeo Santos (320 kbps) 4:30\n'
               '2. Imitadora - Romeo Santos (320 kbps) 3:55')
    match = best_match(target, [result('1', context, 'a' * 43), result('2', context, 'b' * 43)])
    assert match is not None
    assert match['result']['id'] == 'b' * 43


def test_receipt_title_ignores_official_video_and_metadata_suffixes():
    assert receipt_matches_selection(
        'Feid – SI TÚ SUPIERAS 3:17 7.6M 323k',
        'Feid - SI TÚ SUPIERAS (Official Video)')
    assert receipt_matches_selection(
        'Feid – SI TÚ SUPIERAS 3:17 7.6M 323k',
        'Feid - SI TÚ SUPIERAS (Video Oficial)')
    assert receipt_matches_selection('Imitadora - Romeo Santos', 'Imitadora')
    assert not receipt_matches_selection('Imitadora - Romeo Santos', 'Otra canción')


def test_quality_beats_a_longer_low_bitrate_version():
    target = {'title': 'SE ME OLVIDA', 'artist': 'Feid, Maisak', 'duration': 493}
    context = ('Resultados\n'
               '1. Trendee Music – Feid, Maisak - SE ME OLVIDA 8:13 7.7M 130k\n'
               '2. <unknown> – Feid, Maisak - SE ME OLVIDA 3:48 8.7M 320k')
    match = best_match(target, [result('1', context, '1' * 43), result('2', context, '2' * 43)])
    assert match is not None
    assert match['result']['label'] == '2'
    assert match['quality'] == 4


@pytest.mark.parametrize('bad', [None, {}, {'label': '1'}, {'label': 1, 'context': 'x'}])
def test_invalid_candidates_are_ignored(bad):
    assert candidate_line(bad) is None
    assert best_match({'title': 'x', 'artist': 'y'}, [bad]) is None
