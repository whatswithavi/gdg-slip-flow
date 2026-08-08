import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import '../theme/app_theme_controller.dart';
import '../widgets/brutalist_card.dart';
import '../widgets/brutalist_button.dart';
import '../widgets/brutalist_text_field.dart';

/// Photo-based attendance: enroll workers' reference photos, then check
/// someone in by comparing a captured photo against every enrollment.
/// See DECISIONS.md for the reliability/privacy notes on this feature —
/// this uses a general-purpose vision LLM for comparison, not a dedicated
/// face-recognition model, and worker photos are biometric data.
class FaceAttendanceScreen extends StatefulWidget {
  const FaceAttendanceScreen({super.key});

  @override
  State<FaceAttendanceScreen> createState() => _FaceAttendanceScreenState();
}

class _FaceAttendanceScreenState extends State<FaceAttendanceScreen> {
  List<Map<String, dynamic>> _workers = [];
  bool _workersLoading = true;

  final _nameController = TextEditingController();
  Uint8List? _enrollPhoto;
  String _enrollMimeType = 'image/jpeg';
  bool _enrolling = false;
  String? _enrollError;

  Uint8List? _checkinPhoto;
  String _checkinMimeType = 'image/jpeg';
  bool _checkingIn = false;
  String? _checkinError;
  Map<String, dynamic>? _checkinResult;

  @override
  void initState() {
    super.initState();
    _loadWorkers();
    // Enroll button's disabled state depends on the name field being
    // non-empty — without this listener it would only recheck on the next
    // unrelated setState (e.g. after picking a photo), not as the user types.
    _nameController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _loadWorkers() async {
    setState(() => _workersLoading = true);
    try {
      final workers = await ApiClient.fetchWorkers();
      setState(() => _workers = workers);
    } catch (_) {
      // Non-fatal — enroll/check-in still work even if the list fails to load.
    } finally {
      setState(() => _workersLoading = false);
    }
  }

  Future<void> _pickPhoto({required bool forEnroll}) async {
    final picked = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 70, maxWidth: 512);
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    setState(() {
      if (forEnroll) {
        _enrollPhoto = bytes;
        _enrollMimeType = picked.mimeType ?? 'image/jpeg';
      } else {
        _checkinPhoto = bytes;
        _checkinMimeType = picked.mimeType ?? 'image/jpeg';
        _checkinResult = null;
        _checkinError = null;
      }
    });
  }

  Future<void> _enroll() async {
    if (_enrollPhoto == null || _nameController.text.trim().isEmpty) return;
    setState(() {
      _enrolling = true;
      _enrollError = null;
    });
    try {
      await ApiClient.enrollWorker(_nameController.text.trim(), _enrollPhoto!, _enrollMimeType);
      setState(() {
        _nameController.clear();
        _enrollPhoto = null;
      });
      await _loadWorkers();
    } catch (e) {
      setState(() => _enrollError = 'Enroll failed: $e');
    } finally {
      setState(() => _enrolling = false);
    }
  }

  Future<void> _checkIn() async {
    if (_checkinPhoto == null) return;
    setState(() {
      _checkingIn = true;
      _checkinError = null;
      _checkinResult = null;
    });
    try {
      final result = await ApiClient.markAttendance(_checkinPhoto!, _checkinMimeType);
      setState(() => _checkinResult = result);
    } catch (e) {
      setState(() => _checkinError = 'Check-in failed: $e');
    } finally {
      setState(() => _checkingIn = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Face check-in', style: AppTextStyles.sans(fontSize: 20, fontWeight: FontWeight.w900, color: context.ink)),
          const SizedBox(height: 4),
          Text(
            'Photo comparison via AI, not a dedicated face-recognition model — works best for a small team.',
            style: AppTextStyles.sans(fontSize: 12, color: context.inkMuted),
          ),
          const SizedBox(height: 16),
          if (_checkinPhoto != null)
            BrutalistCard(
              backgroundColor: context.cardBg,
              padding: const EdgeInsets.all(8),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.memory(_checkinPhoto!, height: 160, fit: BoxFit.cover, width: double.infinity),
              ),
            ),
          if (_checkinPhoto != null) const SizedBox(height: 12),
          BrutalistButton(
            label: 'Take Photo & Check In',
            icon: Icons.face_retouching_natural,
            backgroundColor: AppColors.vaultPink,
            textColor: AppColors.white,
            onPressed: _checkingIn ? null : () => _pickPhoto(forEnroll: false),
          ),
          if (_checkinPhoto != null) ...[
            const SizedBox(height: 8),
            BrutalistButton(
              label: _checkingIn ? 'Checking in...' : 'Submit Check-In',
              icon: Icons.check_circle_outline,
              backgroundColor: AppColors.vaultGreen,
              onPressed: _checkingIn ? null : _checkIn,
            ),
          ],
          if (_checkinError != null) ...[
            const SizedBox(height: 12),
            Text(_checkinError!, style: AppTextStyles.sans(fontSize: 13, color: Colors.red)),
          ],
          if (_checkinResult != null) ...[
            const SizedBox(height: 12),
            BrutalistCard(
              backgroundColor: context.cardBg,
              borderColor: _checkinResult!['matchedWorkerId'] != null ? AppColors.vaultGreen : Colors.orange,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _checkinResult!['matchedWorkerId'] != null
                        ? 'Matched: ${_checkinResult!['matchedWorkerName']}'
                        : 'Not recognized',
                    style: AppTextStyles.sans(fontSize: 15, fontWeight: FontWeight.w800, color: context.ink),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Confidence: ${(((_checkinResult!['confidence'] ?? 0) as num) * 100).toStringAsFixed(0)}%',
                    style: AppTextStyles.mono(fontSize: 12, color: context.inkMuted),
                  ),
                  if (_checkinResult!['recordId'] != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Attendance record created — review it in the Approve tab.',
                      style: AppTextStyles.sans(fontSize: 12, color: context.inkMuted),
                    ),
                  ],
                ],
              ),
            ),
          ],
          const SizedBox(height: 28),
          Text('Enroll a worker', style: AppTextStyles.sans(fontSize: 18, fontWeight: FontWeight.w900, color: context.ink)),
          const SizedBox(height: 4),
          Text(
            'Reference photo used for future check-ins. Biometric data — enroll with consent.',
            style: AppTextStyles.sans(fontSize: 12, color: context.inkMuted),
          ),
          const SizedBox(height: 12),
          BrutalistTextField(label: 'Worker Name', controller: _nameController),
          const SizedBox(height: 10),
          if (_enrollPhoto != null)
            BrutalistCard(
              backgroundColor: context.cardBg,
              padding: const EdgeInsets.all(8),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.memory(_enrollPhoto!, height: 140, fit: BoxFit.cover, width: double.infinity),
              ),
            ),
          if (_enrollPhoto != null) const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: BrutalistButton(
                  label: 'Take Reference Photo',
                  icon: Icons.camera_alt_outlined,
                  onPressed: _enrolling ? null : () => _pickPhoto(forEnroll: true),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          BrutalistButton(
            label: _enrolling ? 'Enrolling...' : 'Enroll Worker',
            icon: Icons.person_add_alt_1,
            backgroundColor: AppColors.vaultPurple,
            textColor: AppColors.white,
            onPressed: (_enrolling || _enrollPhoto == null || _nameController.text.trim().isEmpty) ? null : _enroll,
          ),
          if (_enrollError != null) ...[
            const SizedBox(height: 8),
            Text(_enrollError!, style: AppTextStyles.sans(fontSize: 12, color: Colors.red)),
          ],
          const SizedBox(height: 20),
          Text('Enrolled workers (${_workers.length})', style: AppTextStyles.sans(fontSize: 13, fontWeight: FontWeight.w800, color: context.inkMuted)),
          const SizedBox(height: 8),
          if (_workersLoading) const Center(child: CircularProgressIndicator()),
          if (!_workersLoading && _workers.isEmpty)
            Text('No workers enrolled yet.', style: AppTextStyles.sans(fontSize: 13, color: context.inkMuted)),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final w in _workers)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: context.cardBg,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: context.ink.withValues(alpha: 0.1)),
                  ),
                  child: Text(w['name'] as String? ?? '', style: AppTextStyles.sans(fontSize: 12, color: context.ink)),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
