import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import '../theme/app_theme_controller.dart';
import '../widgets/brutalist_card.dart';
import '../widgets/brutalist_button.dart';
import '../widgets/brutalist_text_field.dart';

class ApprovalScreen extends StatefulWidget {
  final List<Map<String, dynamic>> registerTypes;

  const ApprovalScreen({super.key, required this.registerTypes});

  @override
  State<ApprovalScreen> createState() => _ApprovalScreenState();
}

class _ApprovalScreenState extends State<ApprovalScreen> {
  List<Map<String, dynamic>> _pending = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final records = await ApiClient.fetchPendingRecords();
      setState(() => _pending = records);
    } catch (e) {
      setState(() => _error = 'Failed to load pending records: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  void _removeFromList(String id) {
    setState(() => _pending.removeWhere((r) => r['id'] == id));
  }

  Map<String, dynamic>? _configFor(String registerType) {
    return widget.registerTypes.cast<Map<String, dynamic>?>().firstWhere((t) => t?['id'] == registerType, orElse: () => null);
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Review pending records', style: AppTextStyles.sans(fontSize: 20, fontWeight: FontWeight.w900, color: context.ink)),
                IconButton(
                  icon: Icon(Icons.refresh, color: context.ink),
                  onPressed: _loading ? null : _load,
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_loading) const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
            if (_error != null)
              Text(_error!, style: AppTextStyles.sans(fontSize: 13, color: Colors.red)),
            if (!_loading && _error == null && _pending.isEmpty)
              Padding(
                padding: const EdgeInsets.all(24),
                child: Text('Nothing pending — upload a record first.', style: AppTextStyles.sans(fontSize: 14, color: context.inkMuted)),
              ),
            for (final record in _pending) ...[
              _PendingRecordCard(
                key: ValueKey(record['id']),
                record: record,
                typeConfig: _configFor(record['registerType'] as String? ?? ''),
                onApproved: () => _removeFromList(record['id'] as String),
                onRejected: () => _removeFromList(record['id'] as String),
              ),
              const SizedBox(height: 12),
            ],
          ],
        ),
      ),
    );
  }
}

class _PendingRecordCard extends StatefulWidget {
  final Map<String, dynamic> record;
  final Map<String, dynamic>? typeConfig;
  final VoidCallback onApproved;
  final VoidCallback onRejected;

  const _PendingRecordCard({
    super.key,
    required this.record,
    required this.typeConfig,
    required this.onApproved,
    required this.onRejected,
  });

  @override
  State<_PendingRecordCard> createState() => _PendingRecordCardState();
}

class _PendingRecordCardState extends State<_PendingRecordCard> {
  final Map<String, TextEditingController> _controllers = {};
  bool _busy = false;
  String? _error;

  List<Map<String, dynamic>> get _fieldDefs => (widget.typeConfig?['fields'] as List?)?.cast<Map<String, dynamic>>() ?? [];

  @override
  void initState() {
    super.initState();
    final fields = widget.record['fields'] as Map? ?? {};
    for (final def in _fieldDefs) {
      final key = def['key'] as String;
      _controllers[key] = TextEditingController(text: fields[key]?.toString() ?? '');
    }
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _approve() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final fields = <String, dynamic>{};
      for (final def in _fieldDefs) {
        final key = def['key'] as String;
        final text = _controllers[key]?.text ?? '';
        fields[key] = def['type'] == 'number' ? num.tryParse(text) : text;
      }
      await ApiClient.approveRecord(widget.record['id'] as String, fields: fields);
      widget.onApproved();
    } catch (e) {
      setState(() => _error = 'Approve failed: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reject() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ApiClient.rejectRecord(widget.record['id'] as String);
      widget.onRejected();
    } catch (e) {
      setState(() => _error = 'Reject failed: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final confidence = (widget.record['confidence'] as num?)?.toDouble() ?? 0;
    final imageUrl = widget.record['imageUrl'] as String?;
    final notes = widget.record['notes'] as String?;
    final typeLabel = widget.typeConfig?['label'] as String? ?? widget.record['registerType'] as String? ?? 'Record';

    return BrutalistCard(
      backgroundColor: context.cardBg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: imageUrl != null
                    ? Image.network(imageUrl, width: 64, height: 64, fit: BoxFit.cover)
                    : Container(
                        width: 64,
                        height: 64,
                        color: context.ink.withValues(alpha: 0.06),
                        child: Icon(Icons.image_not_supported_outlined, color: context.inkMuted, size: 24),
                      ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(typeLabel, style: AppTextStyles.sans(fontSize: 13, fontWeight: FontWeight.w900, color: context.ink)),
                    Text(
                      'Confidence: ${(confidence * 100).toStringAsFixed(0)}%',
                      style: AppTextStyles.sans(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: confidence < 0.6 ? Colors.orange.shade800 : AppColors.vaultGreen,
                      ),
                    ),
                    if (notes != null && notes.isNotEmpty)
                      Text(notes, style: AppTextStyles.sans(fontSize: 11, color: context.inkMuted)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          for (final def in _fieldDefs) ...[
            BrutalistTextField(
              label: def['label'] as String,
              controller: _controllers[def['key']]!,
              keyboardType: def['type'] == 'number' ? TextInputType.number : TextInputType.text,
            ),
            const SizedBox(height: 10),
          ],
          if (_error != null) ...[
            Text(_error!, style: AppTextStyles.sans(fontSize: 12, color: Colors.red)),
            const SizedBox(height: 8),
          ],
          Row(
            children: [
              Expanded(
                child: BrutalistButton(
                  label: 'Reject',
                  backgroundColor: Colors.red.shade400,
                  textColor: AppColors.white,
                  onPressed: _busy ? null : _reject,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: BrutalistButton(
                  label: 'Approve',
                  backgroundColor: AppColors.vaultGreen,
                  onPressed: _busy ? null : _approve,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
