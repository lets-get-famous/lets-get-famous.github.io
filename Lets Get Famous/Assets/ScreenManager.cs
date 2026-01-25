using UnityEngine;
using UnityEngine.UI;

public class ScreenManager : MonoBehaviour
{
    [Header("Buttons (TMP UGUI)")]
    [SerializeField] private Button startButton;
    [SerializeField] private Button settingsButton;
    [SerializeField] private Button creditsButton;
    [SerializeField] private Button exitButton;

    [Header("Panels")]
    [SerializeField] private GameObject mainMenuPanel;   // contains Start / Settings / Credits / Exit
    [SerializeField] private GameObject settingsPanel;
    [SerializeField] private GameObject creditsPanel;

    private void Awake()
    {
        if (startButton != null) startButton.onClick.AddListener(OnStartClicked);
        if (settingsButton != null) settingsButton.onClick.AddListener(OnSettingsClicked);
        if (creditsButton != null) creditsButton.onClick.AddListener(OnCreditsClicked);
        if (exitButton != null) exitButton.onClick.AddListener(OnExitClicked);
    }

    private void OnDestroy()
    {
        if (startButton != null) startButton.onClick.RemoveListener(OnStartClicked);
        if (settingsButton != null) settingsButton.onClick.RemoveListener(OnSettingsClicked);
        if (creditsButton != null) creditsButton.onClick.RemoveListener(OnCreditsClicked);
        if (exitButton != null) exitButton.onClick.RemoveListener(OnExitClicked);
    }

    private void OnStartClicked()
    {
        Debug.Log("Start clicked");

        // Hide ALL menu buttons once Start is pressed
        if (mainMenuPanel != null)
            mainMenuPanel.SetActive(false);

        // TODO: start game logic here later
    }

    private void OnSettingsClicked()
    {
        Debug.Log("Settings clicked");

        if (mainMenuPanel != null)
            mainMenuPanel.SetActive(false);

        ShowPanel(settingsPanel);
    }

    private void OnCreditsClicked()
    {
        Debug.Log("Credits clicked");

        if (mainMenuPanel != null)
            mainMenuPanel.SetActive(false);

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

    // Hook this to a "Back" button on Settings / Credits panels
    public void BackToMenu()
    {
        ShowPanel(null);

        if (mainMenuPanel != null)
            mainMenuPanel.SetActive(true);
    }

    private void ShowPanel(GameObject panelToShow)
    {
        if (settingsPanel != null)
            settingsPanel.SetActive(panelToShow == settingsPanel);

        if (creditsPanel != null)
            creditsPanel.SetActive(panelToShow == creditsPanel);
    }
}
