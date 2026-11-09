from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from telegram_bridge_queue import BridgeQueue, BridgeQueueError


def test_job_can_be_claimed_only_once():
    queue = BridgeQueue(clock=lambda: 10)
    identifier = queue.submit(operator='alice', query='Romeo Santos')
    assert queue.claim() == {'id': identifier, 'query': 'Romeo Santos'}
    assert queue.claim() is None
    assert queue.status(identifier=identifier, operator='alice') == 'claimed'
    with pytest.raises(BridgeQueueError):
        queue.status(identifier=identifier, operator='bob')


def test_client_identifier_and_owner_recovery():
    queue = BridgeQueue(clock=lambda: 10)
    identifier = 'a' * 43
    assert queue.submit(operator='alice', query='song', identifier=identifier) == identifier
    assert queue.active(operator='alice') == {'id': identifier, 'state': 'pending'}
    assert queue.active(operator='bob') is None


def test_invalid_client_identifier_is_rejected():
    queue = BridgeQueue(clock=lambda: 10)
    with pytest.raises(BridgeQueueError):
        queue.submit(operator='alice', query='song', identifier='../not-valid')


def test_concurrent_claim_has_one_winner():
    queue = BridgeQueue(clock=lambda: 10)
    queue.submit(operator='alice', query='song')
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: queue.claim(), range(20)))
    assert sum(result is not None for result in results) == 1


def test_timeout_after_claim_is_uncertain_not_retried():
    now = [10]
    queue = BridgeQueue(clock=lambda: now[0], timeout=5)
    identifier = queue.submit(operator='alice', query='song')
    queue.claim()
    now[0] = 15
    assert queue.status(identifier=identifier, operator='alice') == 'uncertain'
    assert queue.claim() is None
    assert queue.status(identifier=identifier, operator='alice') == 'uncertain'
    with pytest.raises(BridgeQueueError):
        queue.submit(operator='alice', query='another')


@pytest.mark.parametrize('query', ['', '/start', 'abc\nxyz', 'a' * 201])
def test_rejects_bad_search(query):
    queue = BridgeQueue(clock=lambda: 10)
    with pytest.raises(BridgeQueueError):
        queue.submit(operator='alice', query=query)


def test_completed_results_are_owned_copied_and_explicitly_cleared():
    queue = BridgeQueue(clock=lambda: 10)
    identifier = queue.submit(operator='alice', query='song')
    queue.claim()
    labels = [{'id': 'a' * 43, 'label': 'Canción 1', 'context': 'Resultados', 'relation': 'indeterminado'}]
    queue.finish(identifier=identifier, results=labels)
    labels[0]['label'] = 'changed'
    assert queue.result(identifier=identifier, operator='alice') == {'state': 'completed', 'results': [{'id': 'a' * 43, 'label': 'Canción 1', 'context': 'Resultados', 'relation': 'indeterminado'}]}
    with pytest.raises(BridgeQueueError):
        queue.result(identifier=identifier, operator='bob')
    queue.clear(identifier=identifier, operator='alice')
    assert queue.submit(operator='alice', query='otra')


def test_late_completion_is_refused_and_uncertainty_requires_clear():
    now = [10]
    queue = BridgeQueue(clock=lambda: now[0], timeout=5)
    identifier = queue.submit(operator='alice', query='song')
    queue.claim()
    now[0] = 15
    with pytest.raises(BridgeQueueError):
        queue.finish(identifier=identifier, results=[{'id': 'a' * 43, 'label': 'late', 'context': 'Resultados', 'relation': 'vinculado'}])
    assert queue.result(identifier=identifier, operator='alice')['state'] == 'uncertain'
    queue.clear(identifier=identifier, operator='alice')


def test_invalid_results_and_active_clear_are_rejected():
    queue = BridgeQueue(clock=lambda: 10)
    identifier = queue.submit(operator='alice', query='song')
    with pytest.raises(BridgeQueueError):
        queue.clear(identifier=identifier, operator='alice')
    queue.claim()
    for results in [['bad\ntext'], ['x' * 201], [''] * 51]:
        with pytest.raises(BridgeQueueError):
            queue.finish(identifier=identifier, results=results)
    queue.finish(identifier=identifier, failed=True)
    assert queue.result(identifier=identifier, operator='alice')['state'] == 'uncertain'


def test_selection_requires_owner_and_explicit_acknowledgements():
    queue = BridgeQueue(clock=lambda: 10)
    identifier = queue.submit(operator='alice', query='song')
    queue.claim()
    option = 'a' * 43
    queue.finish(identifier=identifier, results=[{'id': option, 'label': 'Song', 'context': 'Resultados', 'relation': 'indeterminado'}])
    for operator, publication, uncertainty in [('bob', True, True), ('alice', False, True),
                                               ('alice', True, False), ('alice', 1, True)]:
        with pytest.raises(BridgeQueueError):
            queue.select(identifier=identifier, operator=operator, result_id=option,
                         accepts_group_publication=publication, accepts_uncertainty=uncertainty, rights_confirmed=True)
    with pytest.raises(BridgeQueueError):
        queue.select(identifier=identifier, operator='alice', result_id=option,
                     accepts_group_publication=True, accepts_uncertainty=True, rights_confirmed=False)
    queue.select(identifier=identifier, operator='alice', result_id=option,
                 accepts_group_publication=True, accepts_uncertainty=True, rights_confirmed=True)
    assert queue.claim_selection() == {'search_id': identifier, 'result_id': option}
    assert queue.claim_selection() is None
    queue.finish_selection_check(identifier=identifier, verified=True)
    assert queue.result(identifier=identifier, operator='alice')['state'] == 'selection_verified'
    queue.clear(identifier=identifier, operator='alice')


def test_selection_expires_and_cannot_be_taken():
    now = [10]
    queue = BridgeQueue(clock=lambda: now[0], timeout=5)
    identifier = queue.submit(operator='alice', query='song')
    queue.claim()
    option = 'a' * 43
    queue.finish(identifier=identifier, results=[{'id': option, 'label': 'Song', 'context': 'Resultados', 'relation': 'vinculado'}])
    now[0] = 15
    assert queue.result(identifier=identifier, operator='alice')['state'] == 'expired'
    with pytest.raises(BridgeQueueError):
        queue.select(identifier=identifier, operator='alice', result_id=option,
                     accepts_group_publication=True, accepts_uncertainty=False, rights_confirmed=True)
    assert queue.claim_selection() is None


def test_callback_receipt_is_visible_only_to_operator_and_can_be_declined():
    queue = BridgeQueue(clock=lambda: 10)
    identifier = queue.submit(operator='alice', query='song')
    queue.claim()
    option = 'a' * 43
    queue.finish(identifier=identifier, results=[{'id': option, 'label': 'Song', 'context': 'Resultados', 'relation': 'vinculado'}])
    queue.select(identifier=identifier, operator='alice', result_id=option,
                 accepts_group_publication=True, accepts_uncertainty=False, rights_confirmed=True)
    queue.claim_selection()
    receipt = {'id': 'b' * 43, 'message_id': 123, 'size': 42, 'mime_type': 'audio/mpeg', 'title': 'Song'}
    queue.finish_callback(identifier=identifier, confirmed=True, receipt=receipt)
    receipt['title'] = 'changed'
    assert queue.result(identifier=identifier, operator='alice')['state'] == 'receipt_pending'
    assert queue.receipt(identifier=identifier, operator='alice')['title'] == 'Song'
    with pytest.raises(BridgeQueueError):
        queue.receipt(identifier=identifier, operator='bob')
    queue.clear(identifier=identifier, operator='alice')


def test_receipt_requires_explicit_confirmation_and_download_is_single_claim():
    queue = BridgeQueue(clock=lambda: 10)
    identifier = queue.submit(operator='alice', query='song')
    queue.claim()
    option = 'a' * 43
    queue.finish(identifier=identifier, results=[{'id': option, 'label': 'Song', 'context': 'Resultados', 'relation': 'vinculado'}])
    queue.select(identifier=identifier, operator='alice', result_id=option,
                 accepts_group_publication=True, accepts_uncertainty=False, rights_confirmed=True)
    queue.claim_selection()
    receipt = {'id': 'b' * 43, 'message_id': 123, 'size': 42, 'mime_type': 'audio/mpeg', 'title': 'Song'}
    queue.finish_callback(identifier=identifier, confirmed=True, receipt=receipt)
    with pytest.raises(BridgeQueueError):
        queue.approve_receipt(identifier=identifier, operator='alice', receipt_id=receipt['id'],
                              recognized=True, rights_confirmed=False)
    with pytest.raises(BridgeQueueError):
        queue.approve_receipt(identifier=identifier, operator='bob', receipt_id=receipt['id'],
                              recognized=True, rights_confirmed=True)
    queue.approve_receipt(identifier=identifier, operator='alice', receipt_id=receipt['id'],
                          recognized=True, rights_confirmed=True)
    assert queue.claim_download() == {'search_id': identifier, 'receipt_id': receipt['id']}
    assert queue.claim_download() is None
    queue.finish_download(identifier=identifier, saved=True)
    assert queue.result(identifier=identifier, operator='alice')['state'] == 'quarantined'


def test_deadline_renews_for_each_stage():
    now = [10]
    queue = BridgeQueue(clock=lambda: now[0], timeout=10)
    identifier = queue.submit(operator='alice', query='song')
    now[0] = 19
    queue.claim()
    now[0] = 28
    option = 'a' * 43
    queue.finish(identifier=identifier, results=[{'id': option, 'label': 'Song', 'context': 'Resultados', 'relation': 'vinculado'}])
    now[0] = 37
    queue.select(identifier=identifier, operator='alice', result_id=option,
                 accepts_group_publication=True, accepts_uncertainty=False, rights_confirmed=True)
    assert queue.claim_selection() == {'search_id': identifier, 'result_id': option}


def test_auto_download_starts_only_for_matching_title_and_reports_progress():
    queue = BridgeQueue(clock=lambda: 10)
    identifier = queue.submit(operator='alice', query='Romeo Santos')
    queue.claim()
    option = 'a' * 43
    queue.finish(identifier=identifier, results=[
        {'id': option, 'label': 'Imitadora - Romeo Santos', 'context': '1. Imitadora - Romeo Santos',
         'relation': 'vinculado'}])
    queue.select(identifier=identifier, operator='alice', result_id=option,
                 accepts_group_publication=True, accepts_uncertainty=False, rights_confirmed=True,
                 auto_download=True)
    queue.claim_selection()
    receipt = {'id': 'b' * 43, 'message_id': 123, 'size': 1000,
               'mime_type': 'audio/mpeg', 'title': 'Imitadora'}
    queue.finish_callback(identifier=identifier, confirmed=True, receipt=receipt)
    assert queue.result(identifier=identifier, operator='alice')['state'] == 'download_pending'
    with pytest.raises(BridgeQueueError):
        queue.download_progress(identifier=identifier, received=1, total=1000)
    assert queue.claim_download() == {'search_id': identifier, 'receipt_id': receipt['id']}
    assert queue.result(identifier=identifier, operator='alice')['progress'] == 0
    queue.download_progress(identifier=identifier, received=500, total=1000)
    assert queue.result(identifier=identifier, operator='alice')['progress'] == 50
    with pytest.raises(BridgeQueueError):
        queue.download_progress(identifier=identifier, received=400, total=1000)
    with pytest.raises(BridgeQueueError):
        queue.download_progress(identifier=identifier, received=500, total=999)
    queue.finish_download(identifier=identifier, saved=True, validated=True, published=True)
    result = queue.result(identifier=identifier, operator='alice')
    assert result['state'] == 'published' and result['progress'] == 100


def test_auto_download_matches_numeric_button_through_its_context_line():
    queue = BridgeQueue(clock=lambda: 10)
    identifier = queue.submit(operator='alice', query='Romeo Santos')
    queue.claim()
    option = 'a' * 43
    context = 'Resultados\n1. Otra canción - Otro artista\n2. Imitadora - Romeo Santos'
    queue.finish(identifier=identifier, results=[
        {'id': option, 'label': '2', 'context': context, 'relation': 'indeterminado'}])
    queue.select(identifier=identifier, operator='alice', result_id=option,
                 accepts_group_publication=True, accepts_uncertainty=True, rights_confirmed=True,
                 auto_download=True)
    queue.claim_selection()
    receipt = {'id': 'b' * 43, 'message_id': 123, 'size': 1000,
               'mime_type': 'audio/mpeg', 'title': 'Imitadora'}
    queue.finish_callback(identifier=identifier, confirmed=True, receipt=receipt)
    assert queue.result(identifier=identifier, operator='alice')['state'] == 'download_pending'


def test_auto_select_chooses_best_quality_and_exposes_display_label():
    queue = BridgeQueue(clock=lambda: 10)
    identifier = queue.submit(
        operator='alice', query='Romeo Santos Imitadora',
        target={'title': 'Imitadora', 'artist': 'Romeo Santos', 'duration': 235},
        auto_select=True)
    queue.claim()
    context = ('Resultados\n1. Imitadora - Romeo Santos (128 kbps)\n'
               '2. Imitadora - Romeo Santos (320 kbps)')
    queue.finish(identifier=identifier, results=[
        {'id': 'a' * 43, 'label': '1', 'context': context, 'relation': 'indeterminado'},
        {'id': 'b' * 43, 'label': '2', 'context': context, 'relation': 'indeterminado'}])
    result = queue.result(identifier=identifier, operator='alice')
    assert result['state'] == 'selection_pending'
    assert result['selection'] == {'label': 'Imitadora - Romeo Santos (320 kbps)',
                                   'relation': 'indeterminado'}
    assert result['auto_selected'] is True
    assert queue.claim_selection() == {'search_id': identifier, 'result_id': 'b' * 43}


def test_auto_select_ignores_bot_metadata_and_duplicate_entries():
    queue = BridgeQueue(clock=lambda: 10)
    identifier = queue.submit(
        operator='alice', query='Feid Maisak SE ME OLVIDA',
        target={'title': 'Feid, Maisak - SE ME OLVIDA', 'artist': 'Feid', 'duration': 228},
        auto_select=True)
    queue.claim()
    context = '\n'.join([
        'Resultados',
        '1. Karaoke Live – Feid, Maisak - SE ME OLVIDA 3:45 3.6M 132k',
        '2. <unknown> – Feid, Maisak - SE ME OLVIDA 3:48 8.7M 320k',
        '3. Feid, Maisak - SE ME OLVIDA 3:49 2.8M 102k',
        '4. <unknown> – Feid, Maisak - SE ME OLVIDA 3:48 8.7M 320k',
        '5. FeidVEVO – Feid, Maisak - SE ME OLVIDA 3:49 3.7M 134k',
        '6. Feid, Maisak - SE ME OLVIDA 3:48 7.0M 258k',
    ])
    queue.finish(identifier=identifier, results=[
        {'id': str(index) * 43, 'label': str(index), 'context': context,
         'relation': 'indeterminado'} for index in range(1, 7)])
    result = queue.result(identifier=identifier, operator='alice')
    assert result['state'] == 'selection_pending'
    assert result['auto_selected'] is True
    assert result['selection']['label'].startswith('<unknown>')
    assert queue.claim_selection() == {'search_id': identifier, 'result_id': '2' * 43}


def test_auto_select_leaves_ambiguous_or_mismatched_results_for_manual_choice():
    queue = BridgeQueue(clock=lambda: 10)
    identifier = queue.submit(
        operator='alice', query='Romeo Santos Imitadora',
        target={'title': 'Imitadora', 'artist': 'Romeo Santos'},
        auto_select=True)
    queue.claim()
    queue.finish(identifier=identifier, results=[
        {'id': 'a' * 43, 'label': 'Otra canción - Romeo Santos', 'context': 'x',
         'relation': 'indeterminado'}])
    result = queue.result(identifier=identifier, operator='alice')
    assert result['state'] == 'completed'
    assert 'selection' not in result
    assert queue.claim_selection() is None


def test_auto_select_requires_target_and_bool():
    queue = BridgeQueue(clock=lambda: 10)
    with pytest.raises(BridgeQueueError):
        queue.submit(operator='alice', query='song', auto_select=True)
    with pytest.raises(BridgeQueueError):
        queue.submit(operator='alice', query='song', target={'title': 'Song'})
    with pytest.raises(BridgeQueueError):
        queue.submit(operator='alice', query='song', target={'title': ''}, auto_select=True)


def test_auto_download_requires_receipt_title_to_match_selection():
    queue = BridgeQueue(clock=lambda: 10)
    identifier = queue.submit(operator='alice', query='Romeo Santos')
    queue.claim()
    option = 'a' * 43
    queue.finish(identifier=identifier, results=[
        {'id': option, 'label': 'Imitadora - Romeo Santos', 'context': '1. Imitadora - Romeo Santos',
         'relation': 'vinculado'}])
    queue.select(identifier=identifier, operator='alice', result_id=option,
                 accepts_group_publication=True, accepts_uncertainty=False, rights_confirmed=True,
                 auto_download=True)
    queue.claim_selection()
    receipt = {'id': 'b' * 43, 'message_id': 123, 'size': 1000,
               'mime_type': 'audio/mpeg', 'title': 'Otra canción'}
    queue.finish_callback(identifier=identifier, confirmed=True, receipt=receipt)
    assert queue.result(identifier=identifier, operator='alice')['state'] == 'receipt_pending'
    assert queue.claim_download() is None


def test_auto_download_accepts_receipt_with_official_video_suffix():
    queue = BridgeQueue(clock=lambda: 10)
    identifier = queue.submit(operator='alice', query='Feid SI TU SUPIERAS')
    queue.claim()
    option = 'a' * 43
    selection_label = 'Feid – SI TÚ SUPIERAS 3:17 7.6M 323k'
    queue.finish(identifier=identifier, results=[
        {'id': option, 'label': selection_label, 'context': selection_label,
         'relation': 'vinculado'}])
    queue.select(identifier=identifier, operator='alice', result_id=option,
                 accepts_group_publication=True, accepts_uncertainty=False, rights_confirmed=True,
                 auto_download=True)
    queue.claim_selection()
    receipt = {'id': 'b' * 43, 'message_id': 123, 'size': 1000,
               'mime_type': 'audio/mpeg', 'title': 'Feid - SI TÚ SUPIERAS (Official Video)'}
    queue.finish_callback(identifier=identifier, confirmed=True, receipt=receipt)
    assert queue.result(identifier=identifier, operator='alice')['state'] == 'download_pending'
    assert queue.claim_download() == {'search_id': identifier, 'receipt_id': receipt['id']}


def test_published_job_can_be_replaced_without_manual_clear():
    queue = BridgeQueue(clock=lambda: 10)
    identifier = queue.submit(operator='alice', query='song')
    queue.claim()
    option = 'a' * 43
    queue.finish(identifier=identifier, results=[
        {'id': option, 'label': 'Song', 'context': '1. Song', 'relation': 'vinculado'}])
    queue.select(identifier=identifier, operator='alice', result_id=option,
                 accepts_group_publication=True, accepts_uncertainty=False, rights_confirmed=True,
                 auto_download=True)
    queue.claim_selection()
    receipt = {'id': 'b' * 43, 'message_id': 123, 'size': 42,
               'mime_type': 'audio/mpeg', 'title': 'Song'}
    queue.finish_callback(identifier=identifier, confirmed=True, receipt=receipt)
    queue.claim_download()
    queue.finish_download(identifier=identifier, saved=True, validated=True, published=True)
    assert queue.submit(operator='alice', query='otra canción') != identifier
    assert queue.active(operator='alice')['state'] == 'pending'


def test_published_result_exposes_filename_for_autoplay():
    queue = BridgeQueue(clock=lambda: 10)
    identifier = queue.submit(operator='alice', query='song')
    queue.claim()
    option = 'a' * 43
    queue.finish(identifier=identifier, results=[
        {'id': option, 'label': 'Song', 'context': '1. Song', 'relation': 'vinculado'}])
    queue.select(identifier=identifier, operator='alice', result_id=option,
                 accepts_group_publication=True, accepts_uncertainty=False, rights_confirmed=True,
                 auto_download=True)
    queue.claim_selection()
    receipt = {'id': 'b' * 43, 'message_id': 123, 'size': 42,
               'mime_type': 'audio/mpeg', 'title': 'Song'}
    queue.finish_callback(identifier=identifier, confirmed=True, receipt=receipt)
    queue.claim_download()
    filename = 'telegram-' + 'a' * 32 + '.mp3'
    queue.finish_download(identifier=identifier, saved=True, validated=True, published=True,
                          filename=filename)
    assert queue.result(identifier=identifier, operator='alice')['filename'] == filename
    with pytest.raises(BridgeQueueError):
        queue.finish_download(identifier=identifier, saved=True, validated=True, published=True,
                              filename='../../evil.mp3')


def test_container_image_includes_the_matcher_used_by_the_queue():
    # La cola importa telegram_match; si no se copia, el servidor del piloto
    # falla al arrancar aunque las pruebas locales pasen.
    dockerfile = Path(__file__).resolve().parent.parent.joinpath('Dockerfile').read_text(encoding='utf-8')
    assert 'telegram_match.py' in dockerfile
