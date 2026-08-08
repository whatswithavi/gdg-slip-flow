import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import '../theme/app_theme_controller.dart';
import '../widgets/brutalist_card.dart';
import '../widgets/brutalist_button.dart';
import '../widgets/brutalist_text_field.dart';

class ApprovalScreen extends StatefulWidget {
  const ApprovalScreen({super.key});

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
      final slips = await ApiClient.fetchPendingSlips();
      setState(() => _pending = slips);
    } catch (e) {
      setState(() => _error = 'Failed to load pending slips: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  void _removeFromList(String id) {
    setState(() => _pending.removeWhere((s) => s['id'] == id));
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
                Text('Review pending slips', style: AppTextStyles.sans(fontSize: 20, fontWeight: FontWeight.w900, color: context.ink)),
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
                child: Text('Nothing pending — upload a slip first.', style: AppTextStyles.sans(fontSize: 14, color: context.inkMuted)),
              ),
            for (final slip in _pending) ...[
              _PendingSlipCard(
                key: ValueKey(slip['id']),
                slip: slip,
                onApproved: () => _removeFromList(slip['id'] as String),
                onRejected: () => _removeFromList(slip['id'] as String),
              ),
              const SizedBox(height: 12),
            ],
          ],
        ),
      ),
    );
  }
}

class _PendingSlipCard extends StatefulWidget {
  final Map<String, dynamic> slip;
  final VoidCallback onApproved;
  final VoidCallback onRejected;

  const _PendingSlipCard({super.key, required this.slip, required this.onApproved, required this.onRejected});

  @override
  State<_PendingSlipCard> createState() => _PendingSlipCardState();
}

class _PendingSlipCardState extends State<_PendingSlipCard> {
  late final TextEditingController _item;
  late final TextEditingController _quantity;
  late final TextEditingController _unit;
  late final TextEditingController _date;
  late final TextEditingController _supplier;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _item = TextEditingController(text: widget.slip['item']?.toString() ?? '');
    _quantity = TextEditingController(text: widget.slip['quantity']?.toString() ?? '');
    _unit = TextEditingController(text: widget.slip['unit']?.toString() ?? '');
    _date = TextEditingController(text: widget.slip['date']?.toString() ?? '');
    _supplier = TextEditingController(text: widget.slip['supplier']?.toString() ?? '');
  }

  @override
  void dispose() {
    _item.dispose();
    _quantity.dispose();
    _unit.dispose();
    _date.dispose();
    _supplier.dispose();
    super.dispose();
  }

  Future<void> _approve() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ApiClient.approveSlip(
        widget.slip['id'] as String,
        item: _item.text,
        quantity: num.tryParse(_quantity.text),
        unit: _unit.text,
        date: _date.text,
        supplier: _supplier.text,
      );
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
      await ApiClient.rejectSlip(widget.slip['id'] as String);
      widget.onRejected();
    } catch (e) {
      setState(() => _error = 'Reject failed: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final confidence = (widget.slip['confidence'] as num?)?.toDouble() ?? 0;
    final imageUrl = widget.slip['imageUrl'] as String?;
    final notes = widget.slip['notes'] as String?;

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
          BrutalistTextField(label: 'Item', controller: _item),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: BrutalistTextField(label: 'Quantity', controller: _quantity, keyboardType: TextInputType.number)),
              const SizedBox(width: 10),
              Expanded(child: BrutalistTextField(label: 'Unit', controller: _unit)),
            ],
          ),
          const SizedBox(height: 10),
          BrutalistTextField(label: 'Date', controller: _date),
          const SizedBox(height: 10),
          BrutalistTextField(label: 'Supplier', controller: _supplier),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: AppTextStyles.sans(fontSize: 12, color: Colors.red)),
          ],
          const SizedBox(height: 12),
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
