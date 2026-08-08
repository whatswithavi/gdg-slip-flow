import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import '../theme/app_theme_controller.dart';
import '../widgets/brutalist_card.dart';
import '../widgets/brutalist_button.dart';

class UploadScreen extends StatefulWidget {
  final List<Map<String, dynamic>> registerTypes;

  const UploadScreen({super.key, required this.registerTypes});

  @override
  State<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends State<UploadScreen> {
  Uint8List? _imageBytes;
  String _mimeType = 'image/jpeg';
  bool _loading = false;
  String? _statusMessage;
  Map<String, dynamic>? _lastResult;
  bool _lastFailed = false;
  late String _selectedType;

  @override
  void initState() {
    super.initState();
    _selectedType = widget.registerTypes.isNotEmpty ? widget.registerTypes.first['id'] as String : 'intake';
  }

  Future<void> _pickImage(ImageSource source) async {
    final picked = await ImagePicker().pickImage(source: source, imageQuality: 85);
    if (picked == null) return;

    final bytes = await picked.readAsBytes();
    setState(() {
      _imageBytes = bytes;
      _mimeType = picked.mimeType ?? 'image/jpeg';
      _lastResult = null;
      _lastFailed = false;
      _statusMessage = null;
    });
  }

  Future<void> _uploadAndExtract() async {
    if (_imageBytes == null) return;

    setState(() {
      _loading = true;
      _statusMessage = null;
      _lastResult = null;
      _lastFailed = false;
    });

    try {
      final result = await ApiClient.extractRecord(_imageBytes!, _mimeType, _selectedType);
      setState(() {
        _lastResult = result;
        _statusMessage = 'Extracted — review it in the Approve tab.';
      });
    } catch (e) {
      setState(() {
        _lastFailed = true;
        _statusMessage = 'Extraction failed: $e';
      });
    } finally {
      setState(() => _loading = false);
    }
  }

  Map<String, dynamic>? get _selectedTypeConfig =>
      widget.registerTypes.cast<Map<String, dynamic>?>().firstWhere((t) => t?['id'] == _selectedType, orElse: () => null);

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Upload a register', style: AppTextStyles.sans(fontSize: 20, fontWeight: FontWeight.w900, color: context.ink)),
          const SizedBox(height: 4),
          Text(
            'Photograph or pick an image of a paper record.',
            style: AppTextStyles.sans(fontSize: 13, color: context.inkMuted),
          ),
          const SizedBox(height: 12),
          Text('REGISTER TYPE', style: AppTextStyles.sans(fontSize: 11, fontWeight: FontWeight.w800, color: context.inkMuted)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final type in widget.registerTypes)
                _TypeChip(
                  label: type['label'] as String,
                  selected: type['id'] == _selectedType,
                  onTap: _loading ? null : () => setState(() => _selectedType = type['id'] as String),
                ),
            ],
          ),
          const SizedBox(height: 16),
          if (_imageBytes != null)
            BrutalistCard(
              backgroundColor: context.cardBg,
              padding: const EdgeInsets.all(8),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.memory(_imageBytes!, height: 220, fit: BoxFit.cover, width: double.infinity),
              ),
            ),
          if (_imageBytes != null) const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: BrutalistButton(
                  label: 'Camera',
                  icon: Icons.camera_alt_outlined,
                  backgroundColor: AppColors.vaultPink,
                  textColor: AppColors.white,
                  onPressed: _loading ? null : () => _pickImage(ImageSource.camera),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: BrutalistButton(
                  label: 'Gallery',
                  icon: Icons.photo_library_outlined,
                  onPressed: _loading ? null : () => _pickImage(ImageSource.gallery),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          BrutalistButton(
            label: _loading ? 'Extracting...' : 'Upload & Extract',
            icon: Icons.auto_awesome,
            backgroundColor: AppColors.vaultGreen,
            onPressed: (_imageBytes == null || _loading) ? null : _uploadAndExtract,
          ),
          if (_statusMessage != null) ...[
            const SizedBox(height: 16),
            BrutalistCard(
              backgroundColor: context.cardBg,
              borderColor: _lastFailed ? Colors.red : AppColors.vaultGreen,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _statusMessage!,
                    style: AppTextStyles.sans(fontSize: 14, fontWeight: FontWeight.w700, color: context.ink),
                  ),
                  if (_lastResult != null) ...[
                    const SizedBox(height: 8),
                    for (final field in (_selectedTypeConfig?['fields'] as List? ?? []))
                      Text(
                        '${field['label']}: ${(_lastResult!['fields'] as Map?)?[field['key']] ?? '—'}',
                        style: AppTextStyles.mono(fontSize: 13, color: context.inkMuted),
                      ),
                    Text('Confidence: ${((_lastResult!['confidence'] ?? 0) * 100).toStringAsFixed(0)}%',
                        style: AppTextStyles.mono(fontSize: 13, color: context.inkMuted)),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _TypeChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback? onTap;

  const _TypeChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.vaultPurple : context.cardBg,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: context.ink.withValues(alpha: selected ? 0 : 0.12)),
          boxShadow: selected
              ? [BoxShadow(color: AppColors.vaultPurple.withValues(alpha: 0.35), offset: const Offset(0, 2), blurRadius: 8)]
              : [],
        ),
        child: Text(
          label,
          style: AppTextStyles.sans(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: selected ? AppColors.white : context.ink,
          ),
        ),
      ),
    );
  }
}
