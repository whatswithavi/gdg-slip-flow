import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import '../theme/app_theme_controller.dart';
import '../widgets/brutalist_card.dart';
import '../widgets/brutalist_button.dart';
import '../widgets/brutalist_text_field.dart';

class QueryScreen extends StatefulWidget {
  const QueryScreen({super.key});

  @override
  State<QueryScreen> createState() => _QueryScreenState();
}

class _QueryScreenState extends State<QueryScreen> {
  final _questionController = TextEditingController();
  bool _loading = false;
  String? _answer;
  List<String> _citedSlipIds = [];
  String? _error;

  @override
  void dispose() {
    _questionController.dispose();
    super.dispose();
  }

  Future<void> _ask() async {
    final question = _questionController.text.trim();
    if (question.isEmpty) return;

    setState(() {
      _loading = true;
      _error = null;
      _answer = null;
      _citedSlipIds = [];
    });

    try {
      final res = await ApiClient.query(question);
      setState(() {
        _answer = res['answer'] as String?;
        _citedSlipIds = (res['citedSlipIds'] as List?)?.cast<String>() ?? [];
      });
    } catch (e) {
      setState(() => _error = 'Query failed: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Ask about approved slips', style: AppTextStyles.sans(fontSize: 20, fontWeight: FontWeight.w900, color: context.ink)),
          const SizedBox(height: 4),
          Text(
            'Answers come only from approved records, with citations — never guessed.',
            style: AppTextStyles.sans(fontSize: 13, color: context.inkMuted),
          ),
          const SizedBox(height: 16),
          BrutalistTextField(
            label: 'Question',
            controller: _questionController,
            maxLines: 2,
          ),
          const SizedBox(height: 12),
          BrutalistButton(
            label: _loading ? 'Asking...' : 'Ask',
            icon: Icons.search,
            backgroundColor: AppColors.vaultPurple,
            textColor: AppColors.white,
            onPressed: _loading ? null : _ask,
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(_error!, style: AppTextStyles.sans(fontSize: 13, color: Colors.red)),
          ],
          if (_answer != null) ...[
            const SizedBox(height: 16),
            BrutalistCard(
              backgroundColor: context.cardBg,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_answer!, style: AppTextStyles.sans(fontSize: 15, color: context.ink)),
                  const SizedBox(height: 10),
                  if (_citedSlipIds.isNotEmpty)
                    Text(
                      'Sources: ${_citedSlipIds.map((id) => id.substring(0, 8)).join(', ')}',
                      style: AppTextStyles.mono(fontSize: 11, color: context.inkMuted),
                    )
                  else
                    Text(
                      'No matching records — nothing to cite.',
                      style: AppTextStyles.mono(fontSize: 11, color: context.inkMuted),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
