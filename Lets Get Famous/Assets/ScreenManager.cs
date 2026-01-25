using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class ScreenManager : MonoBehaviour
{
    [Header("Buttons (TMP UGUI)")]
    [SerializeField] private Button startButton;
    [SerializeField] private Button settingsButton;
    [SerializeField] private Button creditsButton;
    [SerializeField] private Button exitButton;

    [Header("Screens / Panels (optional)")]
    [SerializeField] private GameObject mainMenuPanel;
    [SerializeField] private GameObject settingsPanel;
    [SerializeField] private GameObject creditsPanel;

    private void Awake()
    {
        // Hook button events here so the Button component's OnClick list stays empty.
        if (startButton != null) startButton.onClick.AddListener(OnStartClicked);
        if (settingsButton != null) settingsButton.onClick.AddListener(OnSettingsClicked);
        if (creditsButton != null) creditsButton.onClick.AddListener(OnCreditsClicked);
        if (exitButton != null) exitButton.onClick.AddListener(OnExitClicked);
    }

    private void OnDestroy()
    {
        // Clean up listeners
        if (startButton != null) startButton.onClick.RemoveListener(OnStartClicked);
        if (settingsButton != null) settingsButton.onClick.RemoveListener(OnSettingsClicked);
        if (creditsButton != null) creditsButton.onClick.RemoveListener(OnCreditsClicked);
        if (exitButton != null) exitButton.onClick.RemoveListener(OnExitClicked);
    }

    private void OnStartClicked()
    {
        Debug.Log("Start clicked");
        // TODO: Load your game scene or start title animation flow
        // SceneManager.LoadScene("Game"); (requires using UnityEngine.SceneManagement)
    }

    private void OnSettingsClicked()
    {
        Debug.Log("Settings clicked");
        ShowPanel(settingsPanel);
    }

    private void OnCreditsClicked()
    {
        Debug.Log("Credits clicked");
        ShowPanel(creditsPanel);
    }

    private void OnExitClicked()
    {
        Debug.Log("Exit clicked");
        Application.Quit();

#if UNITY_EDITOR
        UnityEditor.EditorApplication.isPlaying = false;
#endif
    }

    private void ShowPanel(GameObject panelToShow)
    {
        // If you’re not using panels yet, you can delete this whole section.
        if (mainMenuPanel != null) mainMenuPanel.SetActive(panelToShow == null);
        if (settingsPanel != null) settingsPanel.SetActive(panelToShow == settingsPanel);
        if (creditsPanel != null) creditsPanel.SetActive(panelToShow == creditsPanel);
    }
}
