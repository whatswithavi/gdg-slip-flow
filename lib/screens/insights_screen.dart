import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import '../theme/app_theme_controller.dart';
import '../widgets/brutalist_card.dart';
import '../widgets/brutalist_button.dart';
import '../widgets/brutalist_text_field.dart';

/// Combines the owner-facing pieces that aren't part of the core
/// upload -> approve -> query loop: the DailyDigestAgent's activity summary,
/// and the compliance document library QueryAgent draws on. Kept as one tab
/// rather than two to avoid a 5-tab nav bar for what's still a small amount
/// of screen content each.
class InsightsScreen extends StatefulWidget {
  const InsightsScreen({super.key});

  @override
  State<InsightsScreen> createState() => _InsightsScreenState();
}

class _InsightsScreenState extends State<InsightsScreen> {
  bool _digestLoading = false;
  Map<String, dynamic>? _digest;
  String? _digestError;

  List<Map<String, dynamic>> _docs = [];
  bool _docsLoading = true;
  final _titleController = TextEditingController();
  final _contentController = TextEditingController();
  final _expiryController = TextEditingController();
  bool _uploading = false;
  String? _uploadError;

  @override
  void initState() {
    super.initState();
    _loadDocs();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    _expiryController.dispose();
    super.dispose();
  }

  Future<void> _loadDocs() async {
    setState(() => _docsLoading = true);
    try {
      final docs = await ApiClient.fetchComplianceDocs();
      setState(() => _docs = docs);
    } catch (_) {
      // Non-fatal — the upload form still works even if the list fails to load.
    } finally {
      setState(() => _docsLoading = false);
    }
  }

  Future<void> _generateDigest() async {
    setState(() {
      _digestLoading = true;
      _digestError = null;
    });
    try {
      final result = await ApiClient.fetchDigest();
      setState(() => _digest = result);
    } catch (e) {
      setState(() => _digestError = 'Could not generate digest: $e');
    } finally {
      setState(() => _digestLoading = false);
    }
  }

  Future<void> _uploadDoc() async {
    if (_titleController.text.trim().isEmpty || _contentController.text.trim().isEmpty) return;

    setState(() {
      _uploading = true;
      _uploadError = null;
    });
    try {
      await ApiClient.uploadComplianceDoc(
        _titleController.text.trim(),
        _contentController.text.trim(),
        expiryDate: _expiryController.text.trim(),
      );
      _titleController.clear();
      _contentController.clear();
      _expiryController.clear();
      await _loadDocs();
    } catch (e) {
      setState(() => _uploadError = 'Upload failed: $e');
    } finally {
      setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Daily digest', style: AppTextStyles.sans(fontSize: 20, fontWeight: FontWeight.w900, color: context.ink)),
          const SizedBox(height: 4),
          Text(
            'A short activity summary, generated on demand.',
            style: AppTextStyles.sans(fontSize: 13, color: context.inkMuted),
          ),
          const SizedBox(height: 12),
          BrutalistButton(
            label: _digestLoading ? 'Generating...' : 'Generate digest',
            icon: Icons.summarize_outlined,
            backgroundColor: AppColors.vaultYellowDeep,
            onPressed: _digestLoading ? null : _generateDigest,
          ),
          if (_digestError != null) ...[
            const SizedBox(height: 12),
            Text(_digestError!, style: AppTextStyles.sans(fontSize: 13, color: Colors.red)),
          ],
          if (_digest != null) ...[
            const SizedBox(height: 12),
            BrutalistCard(
              backgroundColor: context.cardBg,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_digest!['summary'] as String? ?? '', style: AppTextStyles.sans(fontSize: 14, color: context.ink)),
                  const SizedBox(height: 8),
                  for (final h in (_digest!['highlights'] as List? ?? []))
                    Text('• $h', style: AppTextStyles.sans(fontSize: 13, color: context.inkMuted)),
                ],
              ),
            ),
          ],
          const SizedBox(height: 24),
          Text('Compliance documents', style: AppTextStyles.sans(fontSize: 20, fontWeight: FontWeight.w900, color: context.ink)),
          const SizedBox(height: 4),
          Text(
            'Uploaded here become citable sources in the Query tab.',
            style: AppTextStyles.sans(fontSize: 13, color: context.inkMuted),
          ),
          const SizedBox(height: 12),
          BrutalistTextField(label: 'Title', controller: _titleController),
          const SizedBox(height: 10),
          BrutalistTextField(label: 'Content', controller: _contentController, maxLines: 4),
          const SizedBox(height: 10),
          BrutalistTextField(label: 'Expiry date (optional)', controller: _expiryController),
          const SizedBox(height: 10),
          BrutalistButton(
            label: _uploading ? 'Uploading...' : 'Add document',
            icon: Icons.upload_file_outlined,
            backgroundColor: AppColors.vaultPurple,
            textColor: AppColors.white,
            onPressed: _uploading ? null : _uploadDoc,
          ),
          if (_uploadError != null) ...[
            const SizedBox(height: 8),
            Text(_uploadError!, style: AppTextStyles.sans(fontSize: 12, color: Colors.red)),
          ],
          const SizedBox(height: 16),
          if (_docsLoading) const Center(child: CircularProgressIndicator()),
          if (!_docsLoading && _docs.isEmpty)
            Text('No compliance documents yet.', style: AppTextStyles.sans(fontSize: 13, color: context.inkMuted)),
          for (final doc in _docs) ...[
            BrutalistCard(
              backgroundColor: context.cardBg,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(doc['title'] as String? ?? '', style: AppTextStyles.sans(fontSize: 14, fontWeight: FontWeight.w800, color: context.ink)),
                  if ((doc['expiryDate'] as String?)?.isNotEmpty == true) ...[
                    const SizedBox(height: 4),
                    Text('Expires: ${doc['expiryDate']}', style: AppTextStyles.mono(fontSize: 11, color: context.inkMuted)),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}
